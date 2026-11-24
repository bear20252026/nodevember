// The meadow's grass, blade by blade, swaying in the storm's gusts; none where the bolt
// bared the earth, and round it singed: yellowed, russet, then charred short stubble. And
// the stones: pebbles in the bared earth, a few rocks sunk in the grass.
import * as THREE from 'three';
import { insideDist, fbm2 } from './common.js';
import { GLSL_SCAR } from './ground.js';

// (the burn is read in the vertex shader, from the strikes' uniforms, so that it can heal and
// burn anew: each blade knows its own green, and singes, shrivels or is gone where it says)
// a colour as GLSL, in the linear space the shaders work in
const glc = (hex) => { const c = new THREE.Color(hex); return `vec3(${c.r.toFixed(4)}, ${c.g.toFixed(4)}, ${c.b.toFixed(4)})`; };

export function createGrass(rand, { outline, height, edge, uniforms, count = 150000 }) {
  // one blade: a strip narrowing to a point, 5 rows
  const ROWS = 5;
  const bp = [], bi = [];
  for (let r = 0; r <= ROWS; r++) {
    const t = r / ROWS;
    if (r < ROWS) bp.push(-0.5, t, 0, 0.5, t, 0);
    else bp.push(0, 1, 0);
  }
  for (let r = 0; r < ROWS - 1; r++) {
    const a = r * 2;
    bi.push(a, a + 1, a + 3, a, a + 3, a + 2);
  }
  bi.push((ROWS - 1) * 2, (ROWS - 1) * 2 + 1, ROWS * 2);
  const geo = new THREE.InstancedBufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(bp, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(bp.map((_, i) => (i % 3 === 2 ? 1 : 0)), 3));
  geo.setIndex(bi);

  let xs = Infinity, xe = -Infinity, zs = Infinity, ze = -Infinity;
  for (const [x, z] of outline) {
    xs = Math.min(xs, x); xe = Math.max(xe, x); zs = Math.min(zs, z); ze = Math.max(ze, z);
  }
  const off = [], prm = [], tint = [], rnd = [];
  const green = [new THREE.Color(0x2f5a1c), new THREE.Color(0x3f6e22), new THREE.Color(0x4d7a2a), new THREE.Color(0x5a7d30), new THREE.Color(0x36521e)];
  const straw = new THREE.Color(0x9a7a32);
  const c = new THREE.Color();
  let n = 0;
  for (let tries = 0; n < count && tries < count * 4; tries++) {
    const x = xs + rand() * (xe - xs), z = zs + rand() * (ze - zs);
    if (insideDist(outline, x, z) < 0.005) continue;
    // the rim: the grass gives out raggedly before the crumbled edge
    const rim = edge.at(x, z);
    if (rim.margin < 0.005 || rand() < rim.wear * 1.1 - 0.05) continue;
    // tufts: the meadow is denser in patches
    const patch = fbm2(x * 0.9 + 40, z * 0.9, 3);
    if (rand() > 0.55 + patch * 1.6) continue;
    const y = height(x, z);
    let h = (0.16 + rand() * 0.2) * (0.8 + patch * 1.2);
    let a = rand() * Math.PI * 2, lean = 0.15 + rand() * 0.45;
    if (rim.margin < 0.3) {
      h *= 0.65 + 0.35 * rand() + rim.margin; // thinner, shorter, on the worn rim
      // and the blades on the lip flop out over it
      const over = (1 - rim.margin / 0.3) * rand();
      if (over > 0.25) {
        a = Math.atan2(rim.oz, rim.ox) + (rand() - 0.5) * 1.4;
        lean = Math.max(lean, 0.5 + over * 0.7);
      }
    }
    off.push(x, y - 0.01, z);
    prm.push(a, h, lean, 0.016 + rand() * 0.012);
    c.copy(green[Math.floor(rand() * green.length)]).multiplyScalar(0.8 + rand() * 0.4);
    if (rand() < 0.08) c.lerp(straw, 0.6); // a few dry blades anywhere
    tint.push(c.r, c.g, c.b);
    rnd.push(rand(), rand()); // how much more or less singed than its spot, and how soon gone where bared
    n++;
  }
  geo.setAttribute('offset', new THREE.InstancedBufferAttribute(new Float32Array(off), 3));
  geo.setAttribute('prm', new THREE.InstancedBufferAttribute(new Float32Array(prm), 4));
  geo.setAttribute('tint', new THREE.InstancedBufferAttribute(new Float32Array(tint), 3));
  geo.setAttribute('rnd', new THREE.InstancedBufferAttribute(new Float32Array(rnd), 2));
  geo.instanceCount = n;

  const mat = new THREE.MeshStandardMaterial({ roughness: 0.72, side: THREE.DoubleSide });
  mat.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, uniforms);
    s.vertexShader = s.vertexShader
      .replace('#include <common>', `#include <common>
        attribute vec3 offset, tint; attribute vec4 prm; attribute vec2 rnd;
        uniform float uTime;
        varying vec3 vTint; varying float vT;
        ${GLSL_SCAR}
        // the blade singed by the strikes: s how scorched (outwards in: wilted, yellow, russet,
        // charred), and how much of it is left standing (0 where the earth is bared)
        float bladeScorch(out float standing) {
          vec2 bw = burnAt(offset.xz);
          float s = clamp(bw.r + (rnd.x - 0.5) * 0.25 * min(1.0, bw.r / 0.12), 0.0, 1.0);
          standing = clamp((rnd.y - (bw.g * 1.6 - 0.2)) * 6.0, 0.0, 1.0);
          return s;
        }
        vec3 singe(vec3 c, float s) {
          if (s <= 0.02) return c;
          c = mix(c, ${glc(0x7a7d3e)}, min(1.0, s / 0.15) * 0.8);
          c = mix(c, ${glc(0x9c8f40)}, smoothstep(0.08, 0.3, s) * 0.75 * step(0.08, s));
          c = mix(c, ${glc(0x7a3e14)}, clamp((s - 0.3) / 0.3, 0.0, 1.0));
          c = mix(c, ${glc(0x141010)}, clamp((s - 0.6) / 0.3, 0.0, 1.0));
          return c;
        }
        float gh(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
        // 3D simplex noise (Ashima Arts / Stefan Gustavson), -1 … 1
        vec4 sPerm(vec4 x) { return mod(((x * 34.0) + 10.0) * x, 289.0); }
        float snoise(vec3 v) {
          const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
          vec3 i = floor(v + dot(v, C.yyy)), x0 = v - i + dot(i, C.xxx);
          vec3 g = step(x0.yzx, x0.xyz), l = 1.0 - g;
          vec3 i1 = min(g.xyz, l.zxy), i2 = max(g.xyz, l.zxy);
          vec3 x1 = x0 - i1 + C.xxx, x2 = x0 - i2 + C.yyy, x3 = x0 - 0.5;
          i = mod(i, 289.0);
          vec4 p = sPerm(sPerm(sPerm(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
          vec4 j = p - 49.0 * floor(p / 49.0);
          vec4 x_ = floor(j / 7.0), y_ = floor(j - 7.0 * x_);
          vec4 x = (x_ * 2.0 + 0.5) / 7.0 - 1.0, y = (y_ * 2.0 + 0.5) / 7.0 - 1.0;
          vec4 h = 1.0 - abs(x) - abs(y);
          vec4 b0 = vec4(x.xy, y.xy), b1 = vec4(x.zw, y.zw);
          vec4 s0 = floor(b0) * 2.0 + 1.0, s1 = floor(b1) * 2.0 + 1.0, sh = -step(h, vec4(0.0));
          vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy, a1 = b1.xzyw + s1.xzyw * sh.zzww;
          vec3 g0 = vec3(a0.xy, h.x), g1 = vec3(a0.zw, h.y), g2 = vec3(a1.xy, h.z), g3 = vec3(a1.zw, h.w);
          vec4 nr = inversesqrt(vec4(dot(g0, g0), dot(g1, g1), dot(g2, g2), dot(g3, g3)));
          g0 *= nr.x; g1 *= nr.y; g2 *= nr.z; g3 *= nr.w;
          vec4 m = max(0.5 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
          m *= m;
          return 105.0 * dot(m * m, vec4(dot(g0, x0), dot(g1, x1), dot(g2, x2), dot(g3, x3)));
        }
        // the wind over the meadow: broad slow swells rolling downwind across it, ripples
        // riding them, a lazy veer from side to side, and each blade's own little flutter
        vec2 meadowWind(vec2 p) {
          const vec2 dir = vec2(0.916, 0.401), perp = vec2(-0.401, 0.916);
          float T = uTime;
          float swell = 0.5 + 0.5 * snoise(vec3(p * 0.42 - dir * T * 0.7, T * 0.12));
          swell *= swell; // long lulls, shorter gusts
          float ripple = snoise(vec3(p * 1.5 - dir * T * 1.1, T * 0.3));
          float veer = snoise(vec3(p * 0.6 + 17.0, T * 0.13));
          float r = gh(p * 53.0);
          float flutter = 0.6 * sin(T * (2.1 + 1.4 * r) + r * 6.2832) + 0.4 * snoise(vec3(p * 6.0, T * 0.7));
          float push = 0.1 + 0.6 * swell + 0.15 * ripple;
          return dir * push + perp * 0.18 * veer + (perp + 0.5 * dir) * flutter * (0.06 + 0.1 * swell);
        }
        // the blade bent forward by its own lean and the wind, turned by its angle
        vec3 blade(vec3 p, float s, float standing, out vec3 nrm) {
          float a = prm.x, h = prm.y * standing, w = prm.w * step(0.001, standing);
          h *= 1.0 - 0.65 * max(0.0, s - 0.3) / 0.7; // the burnt grass shrivelled
          float t = p.y;
          vec2 wind = meadowWind(offset.xz) * 0.85;
          float ca = cos(a), sa = sin(a);
          float lean = prm.z + s * 0.6;
          vec3 fwd = vec3(ca, 0.0, sa), sideV = vec3(-sa, 0.0, ca);
          float b = t * t;
          vec3 bend = vec3(wind.x, 0.0, wind.y);
          vec3 q = p.x * w * (1.0 - 0.85 * t) * sideV + vec3(0.0, t * h * (1.0 - 0.25 * lean * t - 0.4 * dot(wind, wind) * t), 0.0);
          q += fwd * lean * h * b * 0.8 + bend * h * b;
          // the normal follows the bend too: the gusts pass over as a sheen
          nrm = normalize(mix(cross(sideV, normalize(vec3(0.0, 1.0, 0.0) + (fwd * lean * 1.6 + bend * 2.5) * t)), vec3(0.0, 1.0, 0.0), 0.45));
          return q + offset + vec3(0.0, scarH(offset.xz), 0.0);
        }`)
      .replace('#include <beginnormal_vertex>', `float standing; float scorch = bladeScorch(standing);
        vec3 bladeN; vec3 bladeP = blade(position, scorch, standing, bladeN);
        vec3 objectNormal = bladeN;
        #ifdef USE_TANGENT
        vec3 objectTangent = vec3(1.0, 0.0, 0.0);
        #endif`)
      .replace('#include <begin_vertex>', `vec3 transformed = bladeP;
        vTint = singe(tint, scorch); vT = position.y;`);
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vTint; varying float vT;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        diffuseColor.rgb = vTint * mix(0.25, 1.05, vT) + vec3(0.04, 0.05, 0.0) * vT * vT;`);
  };
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.receiveShadow = true;
  return mesh;
}

// a rough rounded rock, to be instanced
export function rockGeometry() {
  const geo = new THREE.IcosahedronGeometry(1, 4);
  const p = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const k = 1 + 0.18 * Math.sin(v.x * 3.1 + 1.3) * Math.sin(v.y * 2.7) + 0.1 * Math.sin(v.z * 5.3 + v.x * 2.0);
    v.multiplyScalar(k);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}
const rockGeo = rockGeometry();
export const rockMaterial = new THREE.MeshStandardMaterial({ roughness: 0.5 }); // wet

// rocks as an instanced mesh: `list` of [x, z, size, scorch], set on the ground at `height`;
// gives the mesh and each one's place, turn, size and colour (to throw them about)
function placeRocks(rand, list, height) {
  const mesh = new THREE.InstancedMesh(rockGeo, rockMaterial, Math.max(1, list.length));
  mesh.count = list.length;
  const m = new THREE.Matrix4(), e = new THREE.Euler();
  const items = list.map(([x, z, s, scorch], i) => {
    const q = new THREE.Quaternion().setFromEuler(e.set(rand() * 6.28, rand() * 6.28, rand() * 6.28));
    const scale = new THREE.Vector3(s * (1 + rand() * 0.6), s * (0.5 + rand() * 0.4), s * (1 + rand() * 0.5));
    const pos = new THREE.Vector3(x, height(x, z) + s * 0.1, z);
    mesh.setMatrixAt(i, m.compose(pos, q, scale));
    const col = new THREE.Color().setHSL(0.08 + rand() * 0.05, 0.05 + rand() * 0.08, 0.09 + rand() * 0.12).multiplyScalar(1 - 0.6 * scorch);
    mesh.setColorAt(i, col);
    return { pos, q, scale, col, size: s };
  });
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return { mesh, items };
}

// a few rocks sunk in the meadow, a scatter of smaller ones near each (none within
// `avoid`'s [x, z, distance]s); gives also where they are, for the strikes to keep off them
export function createRocks(rand, { outline, height, avoid = [] }) {
  const list = [], at = [];
  for (let i = 0, tries = 0; i < 7 && tries < 200; tries++) {
    const x = (rand() - 0.5) * 10, z = (rand() - 0.5) * 10;
    if (insideDist(outline, x, z) < 0.5) continue;
    if (avoid.some(([ax, az, ad]) => Math.hypot(x - ax, z - az) < ad)) continue;
    at.push([x, z]);
    list.push([x, z, 0.1 + rand() * 0.22, 0]);
    i++;
    for (let j = 0; j < 3; j++) list.push([x + (rand() - 0.5) * 0.8, z + (rand() - 0.5) * 0.8, 0.03 + rand() * 0.05, 0]);
  }
  return { ...placeRocks(rand, list, height), at };
}

// the pebbles thrown about the earth a strike bared (`burn` its own burn)
export function createPebbles(rand, { height, burn, strike }) {
  const list = [];
  for (let i = 0; i < 70; i++) {
    const a = rand() * Math.PI * 2, r = Math.sqrt(rand()) * 1.3;
    const x = strike.x + Math.cos(a) * r, z = strike.z + Math.sin(a) * r;
    const b = burn.at(x, z);
    if (b.bare < 0.3) continue;
    list.push([x, z, 0.025 + rand() ** 2 * 0.09, b.scorch]);
  }
  return placeRocks(rand, list, height);
}
