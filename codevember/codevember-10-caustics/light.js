// The grains of light. Each one flies straight along the light's direction,
// meets the moving water, is bent by it (Snell, with the wave's normal where
// and when it hits) or now and then glances off it (Fresnel), slows down in
// the water and goes on straight to the sand, where it goes out and leaves a
// glow. Every one is drawn, a few bright and most faint, and lights the sand
// as much as it shines. Its whole path is worked out once, when it's born: a start, the point
// where it meets the water, an end, and the times it is at each. The shaders
// draw it from that alone — the dot at the head, a thin trail behind that
// bends where the path bends, and its glow on the sand when it lands.
import * as THREE from 'three';
import { IOR, WATER_Y, FLOOR_MIN, BOX_HX, BOX_HZ, BASE_Y, SHELF_HALF, WALL_Z, SHELF_FRONT, toRoom, floorHeight, WATER_GLSL, CUBE_GLSL, BALL_GLSL, ballHit } from './sea.js';

// the glow map covers the tank's sand, and the shelf round it as far as the
// light that leaves through the glass gets
export const GLOW_HALF = BOX_HX + 3;

export function createLight(sea, opts) {
  const { rate, speed, max, dir } = opts;
  // each grain is born at its own height over the water, anywhere between
  // these two, far up: the light comes from far away, from no one place
  const near = opts.near ?? 4.5, far = opts.far ?? 10;
  // and fades in over its first few metres, so none is seen being born
  const reveal = opts.reveal ?? 3;
  const D = dir.clone().normalize();
  const trail = opts.trail; // seconds of path behind the head
  const fade = 0.35; // how long a grain takes to go out on the sand
  const bounceLife = 1.4; // a reflected one flies that long, then fades

  // ---- per grain: start (xyz, t0), meeting the water (xyz, tw), end (xyz, tf), info
  const start = new Float32Array(max * 4).fill(1e9);
  const hit = new Float32Array(max * 4).fill(1e9);
  const exit = new Float32Array(max * 4).fill(1e9); // where it leaves through the far glass (else its end)
  const end = new Float32Array(max * 4).fill(1e9);
  const info = new Float32Array(max * 4);
  const attrs = {
    aStart: new THREE.InstancedBufferAttribute(start, 4),
    aHit: new THREE.InstancedBufferAttribute(hit, 4),
    aExit: new THREE.InstancedBufferAttribute(exit, 4),
    aEnd: new THREE.InstancedBufferAttribute(end, 4),
    aInfo: new THREE.InstancedBufferAttribute(info, 4),
  };
  for (const a of Object.values(attrs)) a.setUsage(THREE.DynamicDrawUsage);

  let next = 0;
  let lo = Infinity, hi = -Infinity, wrapped = false;
  const n = new THREE.Vector3();
  const d1 = new THREE.Vector3();
  let rng = opts.seed >>> 0 || 1;
  const rand = () => {
    rng = (rng + 0x6d2b79f5) >>> 0;
    let t = rng;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  // a few bright grains, most of them faint: each is drawn as bright as it is
  // and lights the sand as much (mean about 0.28)
  const brightness = () => 0.1 + 0.9 * rand() ** 4;

  const BX = BOX_HX, BZ = BOX_HZ;
  // Each grain is aimed at a point of the water's level, over the tank or in
  // the strip beside it on the side the light comes from: those meet the sea
  // as if it went on past the glass, are bent by its waves there just like
  // the others, and go on into the tank under the water — so the sand along
  // that side is lit like the rest, by the same pattern (what happens outside
  // the tank isn't shown). Those that get to the glass on the far side go on
  // through it and out, down onto the shelf beside it.
  const depth = WATER_Y - FLOOR_MIN;
  const sx = (D.x / -D.y) * depth, sz = (D.z / -D.y) * depth;
  const x0 = -BX - Math.max(sx, 0), x1 = BX + Math.max(-sx, 0);
  const z0 = -BZ - Math.max(sz, 0), z1 = BZ + Math.max(-sz, 0);
  const inTank = (x, z) => Math.abs(x) < BX && Math.abs(z) < BZ;
  // along the line from (x, z) with direction d: where it's between the
  // tank's walls, [enter, leave] (enter > leave: never)
  function between(x, z, d) {
    let a0 = 0, a1 = Infinity;
    for (const [p, v, B] of [[x, d.x, BX], [z, d.z, BZ]]) {
      if (Math.abs(v) < 1e-9) {
        if (Math.abs(p) >= B) return [1, 0];
        continue;
      }
      let a = (-B - p) / v, b = (B - p) / v;
      if (a > b) [a, b] = [b, a];
      a0 = Math.max(a0, a);
      a1 = Math.min(a1, b);
    }
    return [a0, a1];
  }
  const r0 = ((IOR - 1) / (IOR + 1)) ** 2;
  const eta = 1 / IOR;
  function spawn(t0) {
    let px, py, pz, sw, wx, wy, wz, tw;
    let ox, oy, oz, to, ex, ey, ez, tf, kind; // kind: 0 glanced off, 1 on the sand, 3 out through the glass, 4 on the ball
    for (let tries = 0; ; tries++) {
      const last = tries > 30;
      // (more of them low than high: the light thins out as it goes up)
      const h = near + (far - near) * rand() ** 1.6, back = h / -D.y;
      px = x0 + rand() * (x1 - x0) - D.x * back; py = WATER_Y + h; pz = z0 + rand() * (z1 - z0) - D.z * back;
      // where it meets the surface: bisected between the heights of its highest
      // crest and its deepest trough (each step a lookup in the baked sea)
      let sa = (py - sea.max - 0.01) / -D.y, sb = (py - sea.min + 0.01) / -D.y;
      for (let i = 0; i < 22; i++) {
        const sm = (sa + sb) / 2;
        if (py + D.y * sm > sea.height(px + D.x * sm, pz + D.z * sm)) sa = sm;
        else sb = sm;
      }
      sw = (sa + sb) / 2;
      wx = px + D.x * sw; wy = py + D.y * sw; wz = pz + D.z * sw;
      tw = t0 + sw / speed;
      const outside = !inTank(wx, wz);
      sea.normal(wx, wz, n);
      const cosi = -D.dot(n);
      const fres = r0 + (1 - r0) * (1 - cosi) ** 5;
      if (rand() < fres) {
        if (outside && !last) continue; // glances off the sea outside the tank: never seen
        // glances off: flies on, up and away, and fades out in the air
        d1.copy(D).addScaledVector(n, 2 * cosi);
        const s = speed * bounceLife;
        ex = wx + d1.x * s; ey = wy + d1.y * s; ez = wz + d1.z * s;
        tf = tw + bounceLife;
        kind = 0;
        ox = ex; oy = ey; oz = ez; to = tf;
        break;
      }
      const k = 1 - eta * eta * (1 - cosi * cosi);
      d1.copy(D).multiplyScalar(eta).addScaledVector(n, eta * cosi - Math.sqrt(k)).normalize();
      const [sIn, sOut] = between(wx, wz, d1);
      if (sIn > sOut) {
        if (!last) continue; // never under the tank's water
        ex = ox = wx; ey = oy = wy; ez = oz = wz; tf = to = tw; kind = 0;
        break;
      }
      // it must get into the tank above the sand (not into the sand's side)
      if (sIn > 0 && wy + d1.y * sIn < floorHeight(wx + d1.x * sIn, wz + d1.z * sIn) && !last) continue;
      const slow = speed / IOR; // slower in the water
      const yOut = wy + d1.y * sOut;
      // the ball, if it's in the way: it goes out on it instead
      const sBall = ballHit(wx, wy, wz, d1.x, d1.y, d1.z);
      if (sBall < sOut && sBall >= Math.max(sIn, 0)) {
        ex = ox = wx + d1.x * sBall; ey = oy = wy + d1.y * sBall; ez = oz = wz + d1.z * sBall;
        tf = to = tw + sBall / slow;
        kind = 4;
      } else if (sOut < Infinity && yOut > floorHeight(wx + d1.x * sOut, wz + d1.z * sOut)) {
        // gets to the far glass before the sand: goes through it, on in the air
        ox = wx + d1.x * sOut; oy = yOut; oz = wz + d1.z * sOut;
        to = tw + sOut / slow;
        // down onto the shelf beside the tank (or against the wall behind it)
        let s = d1.y < -1e-3 ? (oy - BASE_Y) / -d1.y : 3;
        // (in the room's frame, which is turned a little from the tank's)
        const [rox, roz] = toRoom(ox, oz), [rdx, rdz] = toRoom(d1.x, d1.z);
        if (rdz < -1e-6) s = Math.min(s, (WALL_Z - roz) / rdz);
        const lx = rox + rdx * s, lz = roz + rdz * s;
        if (Math.abs(lx) > SHELF_HALF || lz > SHELF_FRONT) s = Math.min(s, 3); // (off the shelf: fades in the air)
        s = Math.min(s, 8);
        ex = ox + d1.x * s; ey = oy + d1.y * s; ez = oz + d1.z * s;
        tf = to + s / speed;
        kind = 3;
      } else {
        // down to the sand: bisected between where it gets under the tank's
        // water and below the deepest dune
        let a = Math.max(sIn, 0), b = Math.min((wy - FLOOR_MIN) / -d1.y, sOut);
        for (let i = 0; i < 16; i++) {
          const sm = (a + b) / 2;
          if (wy + d1.y * sm > floorHeight(wx + d1.x * sm, wz + d1.z * sm)) a = sm;
          else b = sm;
        }
        const s = (a + b) / 2;
        ex = wx + d1.x * s; ey = wy + d1.y * s; ez = wz + d1.z * s;
        tf = tw + s / slow;
        kind = 1;
        ox = ex; oy = ey; oz = ez; to = tf;
      }
      break;
    }
    const i = next, o = i * 4;
    next = (next + 1) % max;
    if (next === 0) wrapped = true;
    lo = Math.min(lo, i);
    hi = Math.max(hi, i);
    start[o] = px; start[o + 1] = py; start[o + 2] = pz; start[o + 3] = t0;
    hit[o] = wx; hit[o + 1] = wy; hit[o + 2] = wz; hit[o + 3] = tw;
    exit[o] = ox; exit[o + 1] = oy; exit[o + 2] = oz; exit[o + 3] = to;
    end[o] = ex; end[o + 1] = ey; end[o + 2] = ez; end[o + 3] = tf;
    info[o] = kind; info[o + 1] = brightness(); info[o + 2] = rand(); info[o + 3] = rand();
  }

  let owed = 0;
  // the grains born between t0 and t1, spread evenly over it
  function emit(t0, t1, r = rate) {
    owed += (t1 - t0) * r;
    const count = Math.floor(owed);
    owed -= count;
    for (let i = 0; i < count; i++) spawn(t0 + ((i + rand()) / count) * (t1 - t0));
    flush();
  }
  function flush() {
    if (lo > hi) return;
    for (const a of Object.values(attrs)) {
      a.clearUpdateRanges();
      if (wrapped || hi - lo + 1 >= max) a.addUpdateRange(0, max * 4);
      else a.addUpdateRange(lo * 4, (hi - lo + 1) * 4);
      a.needsUpdate = true;
    }
    lo = Infinity; hi = -Infinity; wrapped = false;
  }

  // ---- shared shader parts
  const uniforms = {
    uTime: { value: 0 },
    uPrev: { value: 0 },
    uTrail: { value: trail },
    uFade: { value: fade },
    uRes: { value: new THREE.Vector2(1, 1) },
    uWidth: { value: 1.5 },
    uSize: { value: 2.6 },
    uColor: { value: new THREE.Color(1.0, 0.86, 0.62) },
    uTau: { value: opts.tau },
    uGlowHalf: { value: GLOW_HALF },
    uSplat: { value: opts.splat ?? 0.09 },
    uDeposit: { value: opts.deposit },
    uGain: { value: opts.gain ?? 1 },
    uShown: { value: opts.shown ?? 1 },
    // in the air, against the white room, a little brighter; and the
    // brighter grains' trails edged with a thin shade, so they read as lines
    uAir: { value: opts.air ?? 1.6 },
    uWater: { value: opts.water ?? 1 },
    uEdge: { value: opts.edge ?? 0.5 },
    uWide: { value: 1 },
    uReveal: { value: reveal },
    ...sea.uniforms,
  };
  const common = /* glsl */ `
attribute vec4 aStart;
attribute vec4 aHit;
attribute vec4 aExit;
attribute vec4 aEnd;
attribute vec4 aInfo;
uniform float uTime, uTrail, uFade, uShown;
vec3 pathAt(float t) {
  if (t <= aHit.w) return mix(aStart.xyz, aHit.xyz, (t - aStart.w) / max(aHit.w - aStart.w, 1e-4));
  if (t <= aExit.w) return mix(aHit.xyz, aExit.xyz, clamp((t - aHit.w) / max(aExit.w - aHit.w, 1e-4), 0.0, 1.0));
  return mix(aExit.xyz, aEnd.xyz, clamp((t - aExit.w) / max(aEnd.w - aExit.w, 1e-4), 0.0, 1.0));
}
// out through the far glass, at time t: in the room, shown outside the cube too
float outAt(float t) {
  return step(2.5, aInfo.x) * step(aInfo.x, 3.5) * step(aExit.w + 1e-4, t);
}
// landed and going out: on the sand, out on the shelf, or on the ball
float landed() {
  float k = aInfo.x;
  return (step(0.5, k) * step(k, 1.5) + step(2.5, k)) * step(aEnd.w, uTime);
}
// fades in when born (it's born high, out of sight anyway), out once it's landed
float lifeAlpha() {
  return smoothstep(aStart.w, aStart.w + 0.4, uTime) * (1.0 - smoothstep(aEnd.w, aEnd.w + uFade, uTime));
}
// in the air: only the grains that come down on the tank's water (the others
// meet the sea as if it went on past the glass, unseen), along the slanted
// column of the light, its edge a little ragged — and each faded in over its
// first metres, so the light has no top
uniform float uReveal;
float airShown(vec3 p) {
  vec2 q = vec2(${BOX_HX.toFixed(4)}, ${BOX_HZ.toFixed(4)}) - abs(aHit.xz);
  float rim = smoothstep(-0.2, 0.35, min(q.x, q.y) + (aInfo.w - 0.5) * 0.9);
  return rim * smoothstep(0.0, uReveal, distance(p, aStart.xyz));
}
// those flying right by the eye, out of proportion, fade out
float farAlpha() {
  vec3 p = pathAt(clamp(uTime, aStart.w, aEnd.w));
  return smoothstep(2.5, 6.0, distance(cameraPosition, p));
}
`;
  // above the water, or below it: the same grains drawn in two passes, each
  // keeping only its side of the surface
  const fragCommon = /* glsl */ `
uniform float uTime;
uniform float uBelow;
uniform vec3 uColor;
uniform float uGain, uAir, uWater;
// out of the tank, through the glass: 80% fainter
const float OUT_GAIN = 0.2;
${sea.glsl}
${WATER_GLSL}
${CUBE_GLSL}
// how much of it is shown: in the air, along the light's column (air >= 0);
// in the water, inside the glass
float shownAt(vec3 p, float air) {
  return uBelow < 0.5 && air >= 0.0 ? air : inCubeStrict(p);
}
bool otherSide(vec3 p) {
  // out of the tank: in the room, with what's above the water
  if (abs(p.x) > ${(BOX_HX + 0.08).toFixed(4)} || abs(p.z) > ${(BOX_HZ + 0.08).toFixed(4)}) return uBelow > 0.5;
  // well clear of the waves, no need to look the surface up
  if (p.y > ${(sea.max + 0.01).toFixed(4)}) return uBelow > 0.5;
  if (p.y < ${(sea.min - 0.01).toFixed(4)}) return uBelow < 0.5;
  float h = seaHeight(p.xz);
  return uBelow > 0.5 ? p.y > h : p.y <= h;
}
`;

  // the trail: three thin screen-space ribbons (before the water, in it, out of the tank)
  const trailGeo = new THREE.InstancedBufferGeometry();
  {
    const corner = [];
    const index = [];
    for (let seg = 0; seg < 3; seg++) {
      const b = seg * 4;
      for (const end of [0, 1]) for (const side of [-1, 1]) corner.push(seg, end, side);
      index.push(b, b + 1, b + 2, b + 2, b + 1, b + 3);
    }
    trailGeo.setAttribute('corner', new THREE.Float32BufferAttribute(corner, 3));
    trailGeo.setIndex(index);
  }
  const headGeo = new THREE.InstancedBufferGeometry();
  headGeo.setAttribute('corner', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, -1, 1, 0, 1, 1, 0], 3));
  headGeo.setIndex([0, 1, 2, 2, 1, 3]);
  for (const g of [trailGeo, headGeo]) {
    for (const [k, a] of Object.entries(attrs)) g.setAttribute(k, a);
    g.instanceCount = max;
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);
  }

  const trailVert = /* glsl */ `
${common}
attribute vec3 corner;
uniform vec2 uRes;
uniform float uWidth, uWide;
varying vec3 vWorld;
varying float vU;
varying float vSide;
varying float vAlpha;
varying float vOut;
varying float vAir;
void main() {
  if (aInfo.z > uShown) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  float tH = clamp(uTime, aStart.w, aEnd.w);
  float tT = clamp(uTime - uTrail, aStart.w, aEnd.w);
  float tK = clamp(aHit.w, tT, tH), tX = clamp(aExit.w, tT, tH);
  float ta = corner.x < 0.5 ? tT : (corner.x < 1.5 ? tK : tX);
  float tb = corner.x < 0.5 ? tK : (corner.x < 1.5 ? tX : tH);
  vOut = outAt(mix(ta, tb, 0.5));
  vAlpha = lifeAlpha() * aInfo.y * farAlpha();
  if (aInfo.z > uShown || uTime < aStart.w || uTime > aEnd.w + uFade + uTrail || tb - ta < 1e-5) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  vec3 A = pathAt(ta), B = pathAt(tb);
  mat4 pv = projectionMatrix * viewMatrix;
  vec4 ca = pv * vec4(A, 1.0), cb = pv * vec4(B, 1.0);
  if (ca.w < 0.05 || cb.w < 0.05) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  vec2 d = (cb.xy / cb.w - ca.xy / ca.w) * uRes;
  d = length(d) > 1e-4 ? normalize(d) : vec2(1.0, 0.0);
  vec2 nrm = vec2(-d.y, d.x);
  vec4 c = corner.y < 0.5 ? ca : cb;
  // widened sideways, and a little lengthwise so short pieces don't vanish
  c.xy += (nrm * corner.z * uWide + d * (corner.y * 2.0 - 1.0) * 0.5) * uWidth / uRes * c.w;
  gl_Position = c;
  vWorld = corner.y < 0.5 ? A : B;
  // (in the air: on its way down, or glanced off the water; else -1)
  vAir = corner.x < 0.5 || aInfo.x < 0.5 ? airShown(vWorld) : -1.0;
  vU = (mix(ta, tb, corner.y) - (uTime - uTrail)) / uTrail;
  vSide = corner.z;
}`;
  const trailFrag = /* glsl */ `
${fragCommon}
varying vec3 vWorld;
varying float vU;
varying float vSide;
varying float vAlpha;
varying float vOut;
varying float vAir;
void main() {
  if (otherSide(vWorld)) discard;
  float a = pow(clamp(vU, 0.0, 1.0), 1.1) * exp(-vSide * vSide * 2.5) * vAlpha * uGain * 0.55 * max(shownAt(vWorld, vAir), vOut) * mix(1.0, OUT_GAIN, vOut);
  a *= mix(uAir, uWater, uBelow);
  vec3 c = uColor * a;
  if (uBelow > 0.5) c *= waterT(vWorld, cameraPosition);
  gl_FragColor = vec4(c, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

  const headVert = /* glsl */ `
${common}
attribute vec3 corner;
uniform vec2 uRes;
uniform float uSize;
varying vec3 vWorld;
varying vec2 vCorner;
varying float vAlpha;
varying float vLand;
varying float vOut;
varying float vAir;
void main() {
  if (aInfo.z > uShown) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  vAlpha = lifeAlpha() * aInfo.y * farAlpha();
  if (uTime < aStart.w || uTime > aEnd.w + uFade) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  vec3 p = pathAt(clamp(uTime, aStart.w, aEnd.w));
  vOut = outAt(uTime);
  vAir = uTime <= aHit.w || aInfo.x < 0.5 ? airShown(p) : -1.0;
  // landed: a little flash that spreads as it goes out (lifted off the
  // ground towards the eye, so the ground doesn't hide it)
  vLand = landed();
  p += normalize(cameraPosition - p) * 0.06 * vLand;
  vec4 c = projectionMatrix * viewMatrix * vec4(p, 1.0);
  if (c.w < 0.05) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  c.xy += corner.xy * uSize * (1.0 + 2.5 * vLand) / uRes * c.w;
  gl_Position = c;
  vWorld = p;
  vCorner = corner.xy;
}`;
  const headFrag = /* glsl */ `
${fragCommon}
varying vec3 vWorld;
varying vec2 vCorner;
varying float vAlpha;
varying float vLand;
varying float vOut;
varying float vAir;
void main() {
  if (otherSide(vWorld)) discard;
  float r2 = dot(vCorner, vCorner);
  float a = (exp(-r2 * 9.0) * 1.0 + exp(-r2 * 2.5) * 0.08) * vAlpha * uGain * 0.75;
  a = mix(a, (exp(-r2 * 14.0) * 0.6 + exp(-r2 * 3.0) * 0.25) * vAlpha * uGain * 1.4, vLand);
  a *= max(vAir >= 0.0 && uBelow < 0.5 ? vAir : mix(inCubeStrict(vWorld), inCube(vWorld), vLand), vOut) * mix(1.0, OUT_GAIN, vOut);
  a *= mix(uAir, uWater, uBelow);
  vec3 c = uColor * a;
  if (uBelow > 0.5) c *= waterT(vWorld, cameraPosition);
  gl_FragColor = vec4(c, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

  // the shade along a trail: the same ribbon, twice as wide, drawn
  // first, darkening what's behind it on either side of the light (by as much as it says) — only for the
  // brighter grains (their brightness squared), or the thousands of faint
  // ones would grey the whole column of light
  const edgeFrag = /* glsl */ `
${fragCommon}
uniform float uEdge;
varying vec3 vWorld;
varying float vU;
varying float vSide;
varying float vAlpha;
varying float vOut;
varying float vAir;
void main() {
  if (otherSide(vWorld)) discard;
  // (on either side of the light only: none under its core)
  float x = vSide * 2.0; // in the light's half-widths
  float side = exp(-x * x * 0.6) * (1.0 - exp(-x * x * 2.5));
  float a = pow(clamp(vU, 0.0, 1.0), 1.1) * side * vAlpha * vAlpha * uEdge * shownAt(vWorld, vAir) * (1.0 - vOut);
  gl_FragColor = vec4(vec3(clamp(a, 0.0, 0.9)), 1.0);
}`;
  const edgeMaterial = (below) =>
    new THREE.ShaderMaterial({
      uniforms: { ...uniforms, uBelow: { value: below ? 1 : 0 }, uWide: { value: 2 } },
      vertexShader: trailVert,
      fragmentShader: edgeFrag,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      // what's behind, times (1 - a)
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.ZeroFactor,
      blendDst: THREE.OneMinusSrcColorFactor,
    });

  function material(vertexShader, fragmentShader, below) {
    return new THREE.ShaderMaterial({
      uniforms: { ...uniforms, uBelow: { value: below ? 1 : 0 } },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide, // the ribbons face either way, as they go
      blending: THREE.AdditiveBlending,
    });
  }
  const make = (geo, v, f, below) => {
    const m = new THREE.Mesh(geo, material(v, f, below));
    m.frustumCulled = false;
    return m;
  };
  const above = new THREE.Group();
  const below = new THREE.Group();
  above.add(make(trailGeo, trailVert, trailFrag, false), make(headGeo, headVert, headFrag, false));
  below.add(make(trailGeo, trailVert, trailFrag, true), make(headGeo, headVert, headFrag, true));
  // (in the air only: in the water, against its pale veil, it only dimmed them)
  for (const [group, isBelow] of [[above, false]]) {
    const m = new THREE.Mesh(trailGeo, edgeMaterial(isBelow));
    m.frustumCulled = false;
    m.renderOrder = -0.5; // (before the light)
    group.add(m);
  }

  // ---- landing on the sand: a soft spot added to the glow map, drawn from
  // above in the glow map's square, for the grains that landed since last time
  const depositGeo = new THREE.InstancedBufferGeometry();
  depositGeo.setAttribute('corner', headGeo.getAttribute('corner'));
  depositGeo.setIndex(headGeo.getIndex());
  for (const [k, a] of Object.entries(attrs)) depositGeo.setAttribute(k, a);
  depositGeo.instanceCount = max;
  depositGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);
  // (and the same for those that went out on the ball, in its own map, a
  // spot as big as on the sand, stretched in longitude towards its poles)
  const depositMesh = (onBall) => {
    const m = new THREE.Mesh(
      depositGeo,
      new THREE.ShaderMaterial({
        uniforms,
        defines: onBall ? { BALL: 1 } : {},
        vertexShader: /* glsl */ `
attribute vec4 aEnd;
attribute vec4 aInfo;
attribute vec3 corner;
uniform float uTime, uPrev, uGlowHalf, uSplat, uTau, uDeposit;
varying vec2 vCorner;
varying float vAmount;
${BALL_GLSL}
void main() {
  #ifdef BALL
  bool mine = aInfo.x > 3.5;
  #else
  // on the sand, or out on the shelf
  bool mine = (aInfo.x > 0.5 && aInfo.x < 1.5) || (aInfo.x > 2.5 && aInfo.x < 3.5);
  #endif
  if (!mine || aEnd.w <= uPrev || aEnd.w > uTime) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  // already faded by as much as it would have since it landed
  vAmount = uDeposit * aInfo.y * exp(-(uTime - aEnd.w) / uTau);
  vCorner = corner.xy;
  #ifdef BALL
  vec3 n = normalize(aEnd.xyz - BALL_C);
  vec2 uv = ballUV(n);
  vec2 span = uSplat / BALL_R / vec2(3.1415927 * max(sqrt(1.0 - n.z * n.z), 0.15), 1.5707963);
  gl_Position = vec4((uv * 2.0 - 1.0) + corner.xy * span, 0.0, 1.0);
  #else
  gl_Position = vec4((aEnd.xz + corner.xy * uSplat) / uGlowHalf, 0.0, 1.0);
  #endif
}`,
        fragmentShader: /* glsl */ `
varying vec2 vCorner;
varying float vAmount;
void main() {
  float r2 = dot(vCorner, vCorner);
  float g = exp(-r2 * 4.0) * vAmount;
  gl_FragColor = vec4(g, g, g, 1.0);
}`,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    m.frustumCulled = false;
    return m;
  };
  const deposit = depositMesh(false);
  const ballDeposit = depositMesh(true);

  return {
    above,
    below,
    deposit,
    ballDeposit,
    uniforms,
    emit,
    setResolution(w, h, pr) {
      uniforms.uRes.value.set(w, h);
      uniforms.uWidth.value = (opts.width ?? 2.0) * pr;
      uniforms.uSize.value = 2.6 * pr;
    },
  };
}
