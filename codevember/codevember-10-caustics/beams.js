// The beams: now and then, one ray of the light drawn whole, thicker, brighter
// and steadier than the grains — it comes down from high up, and where it
// meets the water it splits as light does: most of it goes in, bent by the
// wave it met (Snell) and on down to the sand, where it lights a spot; a
// little glances off (Fresnel) and goes up and away. Each one grows from its
// start at a walking pace (slower in the water), holds a moment, and fades;
// there are always `count` of them, each followed by the next where it was.
import * as THREE from 'three';
import { IOR, WATER_Y, FLOOR_MIN, BOX_HX, BOX_HZ, BASE_Y, SHELF_HALF, WALL_Z, SHELF_FRONT, toRoom, floorHeight, WATER_GLSL, CUBE_GLSL, BALL_GLSL, ballHit } from './sea.js';
import { GLOW_HALF } from './light.js';

export function createBeams(sea, opts) {
  const D = opts.dir.clone().normalize();
  const count = opts.count ?? 3;
  const pace = opts.pace ?? 4; // m/s the beam grows at, in the air
  const hold = opts.hold ?? 0.4; // s it stays whole once it reaches the sand
  const fadeOut = opts.fade ?? 0.75; // s it takes to fade
  // from far up, each from its own height over the water
  const near = opts.near ?? 4.5, far = opts.far ?? 10;
  const reach = 3; // m the reflected part is drawn for
  const BX = BOX_HX, BZ = BOX_HZ;

  // ---- one ray's path: start, where it meets the water, its end in the
  // water (on the sand or against the glass), and the reflected part's end
  const n = new THREE.Vector3();
  const r = new THREE.Vector3();
  const t = new THREE.Vector3();
  function trace(beam) {
    // anywhere over the water, the light's far side included, so that some
    // get to the far glass before the sand (and out through it, like the grains)
    const tx = -BX * 0.8 + Math.random() * (BX * 1.8 - 0.05);
    const tz = (Math.random() * 2 - 1) * BZ * 0.8;
    const h = near + (far - near) * Math.random(), back = h / -D.y;
    const px = tx - D.x * back, py = WATER_Y + h, pz = tz - D.z * back;
    let sa = (py - sea.max - 0.01) / -D.y, sb = (py - sea.min + 0.01) / -D.y;
    for (let i = 0; i < 24; i++) {
      const sm = (sa + sb) / 2;
      if (py + D.y * sm > sea.height(px + D.x * sm, pz + D.z * sm)) sa = sm;
      else sb = sm;
    }
    const sw = (sa + sb) / 2;
    const wx = px + D.x * sw, wy = py + D.y * sw, wz = pz + D.z * sw;
    sea.normal(wx, wz, n);
    const cosi = -D.dot(n);
    const r0 = ((IOR - 1) / (IOR + 1)) ** 2;
    const fres = r0 + (1 - r0) * (1 - cosi) ** 5;
    r.copy(D).addScaledVector(n, 2 * cosi);
    const eta = 1 / IOR;
    const k = 1 - eta * eta * (1 - cosi * cosi);
    t.copy(D).multiplyScalar(eta).addScaledVector(n, eta * cosi - Math.sqrt(k)).normalize();
    let sWall = Infinity;
    if (t.x) sWall = Math.min(sWall, ((t.x > 0 ? BX : -BX) - wx) / t.x);
    if (t.z) sWall = Math.min(sWall, ((t.z > 0 ? BZ : -BZ) - wz) / t.z);
    sWall = Math.max(sWall, 0);
    // kind: 1 on the sand, 2 on the ball, 3 out through the glass and down
    // onto the shelf, 4 out through the glass and fading in the air
    let s, kind;
    const toWall = sWall < Infinity && wy + t.y * sWall > floorHeight(wx + t.x * sWall, wz + t.z * sWall);
    if (toWall) {
      s = sWall;
      kind = 3;
    } else {
      let a = 0, b = Math.min((wy - FLOOR_MIN) / -t.y, sWall);
      for (let i = 0; i < 18; i++) {
        const sm = (a + b) / 2;
        if (wy + t.y * sm > floorHeight(wx + t.x * sm, wz + t.z * sm)) a = sm;
        else b = sm;
      }
      s = (a + b) / 2;
      kind = 1;
    }
    // the ball, if it's in the way: the beam lands on it
    const sBall = ballHit(wx, wy, wz, t.x, t.y, t.z);
    if (sBall < s) {
      s = sBall;
      kind = 2;
    }
    const ex = wx + t.x * s, ey = wy + t.y * s, ez = wz + t.z * s;
    // out through the glass: on in the air, as the grains do, down onto the
    // shelf beside the tank (or against the wall behind it), else fading out
    let so = 0;
    if (kind === 3) {
      so = t.y < -1e-3 ? (ey - BASE_Y) / -t.y : 3;
      const [rox, roz] = toRoom(ex, ez), [rdx, rdz] = toRoom(t.x, t.z);
      if (rdz < -1e-6) so = Math.min(so, (WALL_Z - roz) / rdz);
      const lx = rox + rdx * so, lz = roz + rdz * so;
      if (Math.abs(lx) > SHELF_HALF || lz > SHELF_FRONT) {
        so = Math.min(so, 3);
        kind = 4;
      }
      so = Math.min(so, 8);
    }
    // it shows already drawn down to some 3 m over the water, and grows on from there
    const t0 = -Math.max(sw - 3 / -D.y, 0) / pace;
    const tw = sw / pace;
    const te = tw + s / (pace / IOR);
    const tf = te + so / pace;
    const tr = tw + reach / pace;
    const u = beam.uniforms;
    u.uA.value.set(px, py, pz, t0);
    u.uH.value.set(wx, wy, wz, tw);
    u.uE.value.set(ex, ey, ez, te);
    u.uX.value.set(ex + t.x * so, ey + t.y * so, ez + t.z * so, tf);
    u.uR.value.set(wx + r.x * reach, wy + r.y * reach, wz + r.z * reach, tr);
    // what share goes each way (the reflected part a little boosted, so it shows)
    u.uShare.value.set(1 - fres, Math.min(1, 0.12 + fres * 4), kind);
    // it starts fading soon after it lands (or has gone its way in the air)
    u.uLife.value = tf + hold + fadeOut;
  }

  // ---- drawing: four ribbons (in, through, off, out of the glass) and two spots (where it
  // enters the water, where it lands), in two passes like the grains
  const ribbonGeo = new THREE.BufferGeometry();
  {
    const corner = [], index = [];
    for (let seg = 0; seg < 4; seg++) {
      const b = seg * 4;
      for (const end of [0, 1]) for (const side of [-1, 1]) corner.push(seg, end, side);
      index.push(b, b + 1, b + 2, b + 2, b + 1, b + 3);
    }
    ribbonGeo.setAttribute('position', new THREE.Float32BufferAttribute(corner, 3));
    ribbonGeo.setIndex(index);
  }
  const spotGeo = new THREE.BufferGeometry();
  {
    const corner = [], index = [];
    for (let spot = 0; spot < 2; spot++) {
      const b = spot * 4;
      for (const [x, y] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) corner.push(x, y, spot);
      index.push(b, b + 1, b + 2, b + 2, b + 1, b + 3);
    }
    spotGeo.setAttribute('position', new THREE.Float32BufferAttribute(corner, 3));
    spotGeo.setIndex(index);
  }

  const shared = {
    uRes: { value: new THREE.Vector2(1, 1) },
    uColor: { value: new THREE.Color(1.0, 0.88, 0.66) },
    uBright: { value: opts.bright ?? 1 },
    uWidth: { value: opts.width ?? 0.03 }, // m: the beam's half-width (its bright core)
    uFadeOut: { value: fadeOut },
    // its patch on the sand: half-size (m), and how bright it settles to, once
    // the glow's fading (tau, s) balances what the ray keeps adding
    uSplat: { value: opts.splat ?? 0.24 },
    uGlowHalf: { value: GLOW_HALF },
    uPatch: { value: opts.patch ?? 1.6 },
    uTau: { value: opts.tau ?? 2.5 },
    uDt: { value: 0 },
    // a soft shade either side of the ray, so it reads against the white room
    uEdge: { value: opts.edge ?? 0.35 },
    ...sea.uniforms,
  };
  const common = /* glsl */ `
uniform vec4 uA, uH, uE, uR, uX;
uniform vec3 uShare;
uniform float uAge, uLife, uFadeOut;
uniform vec2 uRes;
// fades in at birth, out at the end
float lifeAlpha() {
  return smoothstep(0.0, 0.25, uAge) * (1.0 - smoothstep(uLife - uFadeOut, uLife, uAge));
}
// a world size, in pixels where p is, and never thinner than a pixel and a half
float pixels(float w, vec4 clip) {
  return max(w * projectionMatrix[1][1] * uRes.y * 0.5 / clip.w, 1.5);
}
`;
  const fragCommon = /* glsl */ `
uniform float uBelow, uBright;
uniform vec3 uColor;
${sea.glsl}
${WATER_GLSL}
${CUBE_GLSL}
// out of the tank, through the glass: fainter, as the grains are
const float OUT_GAIN = 0.3;
bool otherSide(vec3 p, float out_) {
  // out of the tank: in the room, with what's above the water
  if (out_ > 0.5 || abs(p.x) > ${(BOX_HX + 0.08).toFixed(4)} || abs(p.z) > ${(BOX_HZ + 0.08).toFixed(4)}) return uBelow > 0.5;
  if (p.y > ${(sea.max + 0.01).toFixed(4)}) return uBelow > 0.5;
  if (p.y < ${(sea.min - 0.01).toFixed(4)}) return uBelow < 0.5;
  float h = seaHeight(p.xz);
  return uBelow > 0.5 ? p.y > h : p.y <= h;
}
vec4 shade(vec3 c, vec3 p, float out_) {
  // (in the air, all of it: it's aimed at the tank's water)
  c *= out_ > 0.5 ? OUT_GAIN : (uBelow > 0.5 || p.y < ${(WATER_Y - 0.3).toFixed(4)} ? inCube(p) : 1.0);
  if (uBelow > 0.5) c *= waterT(p, cameraPosition);
  return vec4(c, 1.0);
}
`;

  const ribbonVert = /* glsl */ `
${common}
uniform float uWidth;
varying vec3 vWorld;
varying float vSide, vT, vSeg, vHalo, vAlpha;
void main() {
  float seg = position.x;
  vec4 P0 = seg < 0.5 ? uA : (seg < 2.5 ? uH : uE);
  vec4 P1 = seg < 0.5 ? uH : (seg < 1.5 ? uE : (seg < 2.5 ? uR : uX));
  // only as far as it has grown
  float tEnd = min(P1.w, uAge);
  if (tEnd <= P0.w + 1e-4) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  float tv = position.y < 0.5 ? P0.w : tEnd;
  vec3 p = mix(P0.xyz, P1.xyz, (tv - P0.w) / max(P1.w - P0.w, 1e-4));
  vec3 a = P0.xyz, b = mix(P0.xyz, P1.xyz, (tEnd - P0.w) / max(P1.w - P0.w, 1e-4));
  mat4 pv = projectionMatrix * viewMatrix;
  vec4 ca = pv * vec4(a, 1.0), cb = pv * vec4(b, 1.0);
  if (ca.w < 0.05 || cb.w < 0.05) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  vec2 d = (cb.xy / cb.w - ca.xy / ca.w) * uRes;
  d = length(d) > 1e-4 ? normalize(d) : vec2(1.0, 0.0);
  vec2 nrm = vec2(-d.y, d.x);
  vec4 c = position.y < 0.5 ? ca : cb;
  // the ribbon is a halo four times as wide as the core
  float w = pixels(uWidth, c);
  vHalo = 4.0;
  c.xy += (nrm * position.z * w * vHalo + d * (position.y * 2.0 - 1.0) * w) * 2.0 / uRes * c.w;
  gl_Position = c;
  vWorld = p;
  vSide = position.z;
  vT = tv;
  vSeg = seg;
  vAlpha = lifeAlpha();
}`;
  const ribbonFrag = /* glsl */ `
${fragCommon}
uniform vec4 uA, uH, uE, uR, uX;
uniform vec3 uShare;
uniform float uAge;
varying vec3 vWorld;
varying float vSide, vT, vSeg, vHalo, vAlpha;
void main() {
  float out_ = step(2.5, vSeg);
  if (otherSide(vWorld, out_)) discard;
  float x = vSide * vHalo; // in core half-widths
  float profile = exp(-x * x * 1.2) * 0.75 + exp(-x * x * 0.15) * 0.07;
  float share = vSeg < 0.5 ? 1.0 : (vSeg < 1.5 || vSeg > 2.5 ? uShare.x : uShare.y);
  // the reflected part dies away as it goes
  if (vSeg > 1.5 && vSeg < 2.5) share *= 1.0 - smoothstep(uH.w, uR.w, vT);
  // and so does the part out of the glass, when it lands nowhere
  if (vSeg > 2.5 && uShare.z > 3.5) share *= 1.0 - smoothstep(uE.w, uX.w, vT);
  // fades in over its first metres, far up: it has no top
  share *= smoothstep(uA.w, uA.w + 1.5, vT);
  // brighter at its growing tip
  float tip = exp(-max(uAge - vT, 0.0) * 6.0) * step(vT, uAge + 1e-3) * 1.2;
  float a = profile * share * vAlpha * (1.0 + tip) * uBright;
  gl_FragColor = shade(uColor * a, vWorld, out_);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

  // the shade along it: the ribbon's whole width, drawn first, darkening
  // what's behind it (most along the middle, where the light then lies)
  const edgeFrag = /* glsl */ `
${fragCommon}
uniform vec4 uA, uH, uR;
uniform vec3 uShare;
uniform float uEdge;
varying vec3 vWorld;
varying float vSide, vT, vSeg, vHalo, vAlpha;
void main() {
  // (none on the part gone out through the glass: like the grains', the shade stays in the tank)
  float out_ = step(2.5, vSeg);
  if (out_ > 0.5 || otherSide(vWorld, out_)) discard;
  float x = vSide * vHalo;
  float share = vSeg < 0.5 ? 1.0 : (vSeg < 1.5 ? uShare.x : uShare.y);
  if (vSeg > 1.5) share *= 1.0 - smoothstep(uH.w, uR.w, vT);
  share *= smoothstep(uA.w, uA.w + 1.5, vT);
  float a = exp(-x * x * 0.15) * share * vAlpha * uEdge * (vWorld.y < ${(WATER_Y - 0.3).toFixed(4)} ? inCube(vWorld) : 1.0);
  gl_FragColor = vec4(vec3(clamp(a, 0.0, 0.9)), 1.0);
}`;

  const spotVert = /* glsl */ `
${common}
uniform float uWidth;
varying vec3 vWorld;
varying vec2 vCorner;
varying float vAmount, vOut;
void main() {
  float which = position.z;
  vec4 P = which < 0.5 ? uH : uX;
  // there once the beam has got there (where it lands: the sand, the ball, the shelf)
  float since = uAge - P.w;
  vOut = which > 0.5 && uShare.z > 2.5 ? 1.0 : 0.0;
  if (since < 0.0 || (which > 0.5 && uShare.z > 3.5)) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  vec3 p = P.xyz + normalize(cameraPosition - P.xyz) * 0.08;
  vec4 c = projectionMatrix * viewMatrix * vec4(p, 1.0);
  if (c.w < 0.05) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  // a flash as it arrives, settling to a steady spot
  float flash = 1.0 + 2.0 * exp(-since * 5.0);
  float size = pixels(uWidth * (which < 0.5 ? 5.0 : 8.0), c) * (0.8 + 0.4 * exp(-since * 3.0));
  c.xy += position.xy * size * 2.0 / uRes * c.w;
  gl_Position = c;
  vWorld = p;
  vCorner = position.xy;
  vAmount = lifeAlpha() * flash * (which < 0.5 ? 0.5 : uShare.x * 0.7);
}`;
  const spotFrag = /* glsl */ `
${fragCommon}
varying vec3 vWorld;
varying vec2 vCorner;
varying float vAmount, vOut;
void main() {
  if (otherSide(vWorld, vOut)) discard;
  float r2 = dot(vCorner, vCorner);
  float a = (exp(-r2 * 12.0) + exp(-r2 * 3.0) * 0.25) * vAmount * uBright;
  gl_FragColor = shade(uColor * a, vWorld, vOut);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

  // ---- its patch: added into the sand's glow map every frame while the ray
  // stands on the sand, so it builds up, and fades with the rest once it's gone
  const depositVert = /* glsl */ `
${common}
uniform float uSplat, uGlowHalf, uPatch, uTau, uDt;
varying vec2 vCorner;
varying float vAmount;
${BALL_GLSL}
void main() {
  #ifdef BALL
  bool mine = uShare.z > 1.5 && uShare.z < 2.5;
  #else
  // on the sand, or out on the shelf
  bool mine = (uShare.z > 0.5 && uShare.z < 1.5) || (uShare.z > 2.5 && uShare.z < 3.5);
  #endif
  if (!mine || uAge < uX.w || uDt <= 0.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  // as the ray arrives, nearly all of it at once (spread over this frame's
  // share of a quick 0.08 s rise), then just enough to make up for the fading
  float s1 = uAge - uX.w, s0 = max(s1 - uDt, 0.0);
  float rise = exp(-s0 / 0.08) - exp(-s1 / 0.08);
  vAmount = uPatch * (rise + (s1 - s0) / uTau) * lifeAlpha() * uShare.x;
  vCorner = position.xy;
  #ifdef BALL
  // on the ball's own map: as big as on the sand, stretched in longitude towards its poles
  vec3 n = normalize(uX.xyz - BALL_C);
  vec2 span = uSplat / BALL_R / vec2(3.1415927 * max(sqrt(1.0 - n.z * n.z), 0.15), 1.5707963);
  gl_Position = vec4((ballUV(n) * 2.0 - 1.0) + position.xy * span, 0.0, 1.0);
  #else
  gl_Position = vec4((uX.xz + position.xy * uSplat) / uGlowHalf, 0.0, 1.0);
  #endif
}`;
  const depositFrag = /* glsl */ `
varying vec2 vCorner;
varying float vAmount;
void main() {
  float r2 = dot(vCorner, vCorner);
  float g = exp(-r2 * 4.0) * vAmount;
  gl_FragColor = vec4(g, g, g, 1.0);
}`;
  const quadGeo = new THREE.BufferGeometry();
  quadGeo.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, -1, 1, 0, 1, 1, 0], 3));
  quadGeo.setIndex([0, 1, 2, 2, 1, 3]);
  const deposit = new THREE.Group();
  const ballDeposit = new THREE.Group();

  const above = new THREE.Group();
  const below = new THREE.Group();
  const beams = [];
  for (let i = 0; i < count; i++) {
    const uniforms = {
      ...shared,
      uA: { value: new THREE.Vector4() },
      uH: { value: new THREE.Vector4() },
      uE: { value: new THREE.Vector4() },
      uR: { value: new THREE.Vector4() },
      uX: { value: new THREE.Vector4() },
      uShare: { value: new THREE.Vector3() },
      uAge: { value: 0 },
      uLife: { value: 1 },
    };
    const beam = { uniforms, born: 0 };
    for (const [group, isBelow] of [[above, false], [below, true]]) {
      for (const [geo, v, f] of [[ribbonGeo, ribbonVert, ribbonFrag], [spotGeo, spotVert, spotFrag]]) {
        const m = new THREE.Mesh(
          geo,
          new THREE.ShaderMaterial({
            uniforms: { ...uniforms, uBelow: { value: isBelow ? 1 : 0 } },
            vertexShader: v,
            fragmentShader: f,
            transparent: true,
            depthWrite: false,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending,
          }),
        );
        m.frustumCulled = false;
        m.renderOrder = 2;
        group.add(m);
      }
    }
    for (const [group, isBelow] of [[above, false], [below, true]]) {
      const m = new THREE.Mesh(
        ribbonGeo,
        new THREE.ShaderMaterial({
          uniforms: { ...uniforms, uBelow: { value: isBelow ? 1 : 0 } },
          vertexShader: ribbonVert,
          fragmentShader: edgeFrag,
          transparent: true,
          depthWrite: false,
          side: THREE.DoubleSide,
          // what's behind, times (1 - a)
          blending: THREE.CustomBlending,
          blendEquation: THREE.AddEquation,
          blendSrc: THREE.ZeroFactor,
          blendDst: THREE.OneMinusSrcColorFactor,
        }),
      );
      m.frustumCulled = false;
      m.renderOrder = 1.5; // (before the ray's light)
      group.add(m);
    }
    for (const [group, onBall] of [[deposit, false], [ballDeposit, true]]) {
      const patch = new THREE.Mesh(
        quadGeo,
        new THREE.ShaderMaterial({
          uniforms,
          defines: onBall ? { BALL: 1 } : {},
          vertexShader: depositVert,
          fragmentShader: depositFrag,
          transparent: true,
          depthTest: false,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      patch.frustumCulled = false;
      group.add(patch);
    }
    trace(beam);
    beams.push(beam);
  }
  // already under way when the page opens, each at its own stage
  beams.forEach((b, i) => (b.born = -(i / count) * b.uniforms.uLife.value));

  return {
    above,
    below,
    deposit,
    ballDeposit,
    update(time, dt = 0) {
      shared.uDt.value = dt;
      for (const b of beams) {
        // each followed at once by the next: always `count` of them
        if (time - b.born >= b.uniforms.uLife.value) {
          b.born += b.uniforms.uLife.value;
          trace(b);
          if (time - b.born >= b.uniforms.uLife.value) b.born = time;
        }
        b.uniforms.uAge.value = time - b.born;
      }
    },
    setResolution(w, h) {
      shared.uRes.value.set(w, h);
    },
  };
}
