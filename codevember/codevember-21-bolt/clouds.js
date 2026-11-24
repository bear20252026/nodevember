// The storm clouds over the diorama: a volume ray-marched in a box, its billows from a
// tileable 3D noise barely drifting but churning in place (read through a warp that
// boils), its base heavy and lumpy, its outline following the block's loosely. Lit from
// inside by the bolt: its glow, worked out once (the bolt doesn't move) into a 3D texture
// over the box, from every channel, branches and crawlers too — the cloud is bright where they run in it.
import * as THREE from 'three';
import { core } from './common.js';

const NR = 64; // the noise texture's size

// tileable 3D noise: R billows (value-noise fbm carved by inverted cells), G finer cells
function makeNoise() {
  const hash = (x, y, z, p) => {
    x = ((x % p) + p) % p; y = ((y % p) + p) % p; z = ((z % p) + p) % p;
    let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 2147483647);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  const value = (x, y, z, p) => {
    const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
    const s = (t) => t * t * (3 - 2 * t);
    const fx = s(x - ix), fy = s(y - iy), fz = s(z - iz);
    const l = (a, b, t) => a + (b - a) * t;
    return l(
      l(l(hash(ix, iy, iz, p), hash(ix + 1, iy, iz, p), fx), l(hash(ix, iy + 1, iz, p), hash(ix + 1, iy + 1, iz, p), fx), fy),
      l(l(hash(ix, iy, iz + 1, p), hash(ix + 1, iy, iz + 1, p), fx), l(hash(ix, iy + 1, iz + 1, p), hash(ix + 1, iy + 1, iz + 1, p), fx), fy),
      fz,
    );
  };
  // cells: distance to the nearest of one random point per cell, period p
  const worley = (x, y, z, p) => {
    const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
    let d = 9;
    for (let k = -1; k <= 1; k++) for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const cx = ix + i, cy = iy + j, cz = iz + k;
      const dx = cx + hash(cx, cy, cz, p) - x, dy = cy + hash(cx + 7, cy, cz, p) - y, dz = cz + hash(cx, cy + 7, cz + 3, p) - z;
      d = Math.min(d, dx * dx + dy * dy + dz * dz);
    }
    return Math.sqrt(d);
  };
  const data = new Uint8Array(NR * NR * NR * 4);
  for (let z = 0; z < NR; z++) for (let y = 0; y < NR; y++) for (let x = 0; x < NR; x++) {
    const u = x / NR, v = y / NR, w = z / NR;
    let f = 0, a = 0.5;
    for (let o = 0, p = 4; o < 4; o++, p *= 2) {
      f += a * value(u * p, v * p, w * p, p);
      a *= 0.5;
    }
    f /= 0.9375;
    const c1 = 1 - Math.min(1, worley(u * 4, v * 4, w * 4, 4));
    const c2 = 1 - Math.min(1, worley(u * 8, v * 8, w * 8, 8));
    const c3 = 1 - Math.min(1, worley(u * 16, v * 16, w * 16, 16));
    const cellsF = c1 * 0.625 + c2 * 0.25 + c3 * 0.125;
    // perlin-worley: the fbm's low values pushed down by the cells
    const pw = Math.max(0, Math.min(1, (f - (1 - cellsF)) / (1 - (1 - cellsF) + 1e-3) * 0.5 + f * 0.5));
    const k = 4 * (x + NR * (y + NR * z));
    data[k] = Math.round(pw * 255);
    data[k + 1] = Math.round((c2 * 0.5 + c3 * 0.35 + (1 - Math.min(1, worley(u * 24, v * 24, w * 24, 24))) * 0.15) * 255);
    data[k + 2] = Math.round(f * 255);
    data[k + 3] = 255;
  }
  // stretch the billows over the whole range
  let lo = 255, hi = 0;
  for (let k = 0; k < data.length; k += 4) { lo = Math.min(lo, data[k]); hi = Math.max(hi, data[k]); }
  for (let k = 0; k < data.length; k += 4) data[k] = Math.round(((data[k] - lo) / Math.max(1, hi - lo)) * 255);
  const tex = new THREE.Data3DTexture(data, NR, NR, NR);
  tex.format = THREE.RGBAFormat;
  tex.wrapS = tex.wrapT = tex.wrapR = THREE.RepeatWrapping;
  tex.minFilter = tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

// the bolt's light in the box: for each voxel, the glow of every bit of channel near it
const LIGHT_RES = [56, 32, 56];
function lightPoints(channels, bmin) {
  const pts = [];
  for (const ch of channels) {
    if (ch.kind === 2) continue;
    for (let i = 0; i < ch.pts.length; i += ch.kind === 0 ? 2 : 3) {
      const p = ch.pts[i];
      if (p.y < bmin.y - 1.5) continue;
      pts.push(p.x, p.y, p.z, ch.power[i] * (ch.kind === 0 ? 1 : 0.6));
    }
  }
  return new Float32Array(pts);
}
// the voxels of the z slices [z0, z1)
function bakeLight(P, data, bmin, bmax, z0, z1) {
  const [nx, ny, nz] = LIGHT_RES;
  const size = bmax.clone().sub(bmin);
  const np = P.length / 4;
  const norm = 0.02;
  for (let z = z0; z < z1; z++) for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
    const px = bmin.x + ((x + 0.5) / nx) * size.x, py = bmin.y + ((y + 0.5) / ny) * size.y, pz = bmin.z + ((z + 0.5) / nz) * size.z;
    let s = 0;
    for (let i = 0; i < np; i++) {
      const dx = P[4 * i] - px, dy = P[4 * i + 1] - py, dz = P[4 * i + 2] - pz;
      const d2 = dx * dx + dy * dy + dz * dz;
      s += P[4 * i + 3] / (d2 + 0.12) * Math.exp(-Math.sqrt(d2) * 0.9);
    }
    data[x + nx * (y + ny * z)] = THREE.DataUtils.toHalfFloat(s * norm);
  }
}
function makeLightVolume(channels, bmin, bmax) {
  const [nx, ny, nz] = LIGHT_RES;
  const data = new Uint16Array(nx * ny * nz);
  bakeLight(lightPoints(channels, bmin), data, bmin, bmax, 0, nz);
  const tex = new THREE.Data3DTexture(data, nx, ny, nz);
  tex.format = THREE.RedFormat;
  tex.type = THREE.HalfFloatType;
  tex.minFilter = tex.magFilter = THREE.LinearFilter;
  tex.wrapS = tex.wrapT = tex.wrapR = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

export function createClouds({ outline, channels, base, top, uniforms, steps = 56 }) {
  const bmin = new THREE.Vector3(-8.5, base - 1.5, -8.5), bmax = new THREE.Vector3(8.5, top, 8.5);
  const noise = makeNoise();
  const light = makeLightVolume(channels, bmin, bmax);
  const mid = core(outline);
  const poly = outline.map(([x, z]) => new THREE.Vector2(x, z));
  while (poly.length < 6) poly.push(poly[poly.length - 1].clone());
  const geo = new THREE.BoxGeometry(1, 1, 1);
  geo.translate(0.5, 0.5, 0.5);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    uniforms: {
      ...uniforms,
      uNoise: { value: noise },
      uLight: { value: light },
      uMin: { value: bmin },
      uMax: { value: bmax },
      uBase: { value: base },
      uTop: { value: top },
      uPoly: { value: poly },
      uN: { value: outline.length },
      uCore: { value: new THREE.Vector3(mid.cx, mid.cz, mid.r) },
      uGlow: { value: new THREE.Color(0.75, 0.68, 1.0).multiplyScalar(2.6) },
      uChurn: { value: 0 }, // the churning's own clock, running faster in turbulence
      uTurb: { value: 0 }, // how turbulent (0 calm … 1 a ton)
    },
    vertexShader: /* glsl */ `
      uniform vec3 uMin, uMax;
      varying vec3 vW;
      void main() {
        vec3 p = uMin + position * (uMax - uMin);
        vW = (modelMatrix * vec4(p, 1.0)).xyz;
        gl_Position = projectionMatrix * viewMatrix * vec4(vW, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      precision highp sampler3D;
      uniform sampler3D uNoise, uLight;
      uniform vec3 uMin, uMax, uGlow;
      uniform float uBase, uTop, uTime, uChurn, uTurb;
      uniform vec2 uPoly[6];
      uniform int uN;
      uniform vec3 uCore; // the middle (xz) and how deep it is
      varying vec3 vW;
      float h12(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
      // inside (positive) the block's outline, in units
      float inside(vec2 p) {
        float d = 1e9;
        for (int i = 0; i < 6; i++) {
          if (i >= uN) break;
          vec2 a = uPoly[i], b = uPoly[i + 1 < uN ? i + 1 : 0];
          vec2 e = b - a;
          d = min(d, dot(p - a, vec2(-e.y, e.x)) / length(e));
        }
        return d;
      }
      // how deep in the storm, 1 over the middle, 0 at the block's edge, its corners rounded
      float deep(vec2 p) { return (0.5 * inside(p) + 0.5 * (uCore.z - length(p - uCore.xy))) / uCore.z; }
      // the slow drift of the whole: barely moving across, the clouds stay over the block
      vec3 drift() { return vec3(uTime * 0.008, uTime * -0.002, uTime * 0.004); }
      // the turbulence: the space the billows are read in, churned in place — two warp
      // fields scrolling against each other (one rising, one sinking), so they boil and
      // roll without being carried off
      vec3 churn(vec3 p) {
        vec4 w1 = texture(uNoise, p * 0.075 + vec3(0.11, uChurn * 0.03, 0.47));
        vec4 w2 = texture(uNoise, p.zxy * 0.075 + vec3(0.63, uChurn * -0.026, 0.29));
        vec3 w = vec3(w1.b, w2.b, w1.g * 0.5 + w2.g * 0.5) - vec3(0.5, 0.5, 0.42);
        // finer eddies over it
        vec4 e = texture(uNoise, p * 0.21 + w * (0.6 + 0.9 * uTurb) + vec3(uChurn * 0.02, uChurn * -0.035, uChurn * -0.015));
        // in turbulence the warp much deeper, and a third, tighter layer of eddies tearing at it
        vec3 c = w * (2.4 + 2.6 * uTurb) + (vec3(e.b, e.r, e.g) - 0.5) * (0.7 + 1.8 * uTurb);
        if (uTurb > 0.01) {
          vec4 g = texture(uNoise, p.yzx * 0.47 + c * 0.25 + vec3(uChurn * -0.06, uChurn * 0.08, uChurn * 0.05));
          c += (vec3(g.g, g.b, g.r) - 0.5) * 1.1 * uTurb;
        }
        return c;
      }
      // the cloud's density, and (out) its height in the layer 0..1
      float density(vec3 p, out float hh, bool fine) {
        vec3 q = p + churn(p);
        vec4 big = texture(uNoise, mix(p, q, 0.45) * 0.045 + drift() * 0.4 + vec3(0.3, 0.1, 0.7));
        // the base sags and bulges (heavier near the bolt's column), the top rises in domes
        float lump = texture(uNoise, vec3(q.x, 0.0, q.z) * 0.33 + drift() * vec3(1.0, 0.0, 1.0)).r;
        float b = uBase - 0.6 * smoothstep(0.45, 0.8, big.b) + 0.15 * (big.r - 0.5) - 0.6 * smoothstep(0.3, 0.9, lump);
        float t = uTop - 0.2 - 2.4 * (1.0 - big.r) * (1.0 - big.r);
        float h = (p.y - b) / max(t - b, 0.3);
        hh = clamp(h, 0.0, 1.0);
        if (h < 0.0 || h > 1.0) return 0.0;
        // thick over the middle, thinning out and breaking up well before the edge, raggedly
        float edge = deep(p.xz) + (big.g - 0.5) * 0.6;
        float cover = smoothstep(-0.38, 0.55, edge);
        if (cover <= 0.0) return 0.0;
        // rounded bottom, domed top
        float prof = smoothstep(0.0, 0.16, h) * smoothstep(1.0, 0.45, h) * (0.85 + 0.3 * h);
        vec4 n = texture(uNoise, q * 0.13 + drift());
        vec4 m = texture(uNoise, q * 0.29 - drift() * 1.6 + vec3(0.5)); // against the other: they shear
        float d = (n.r * 0.5 + m.r * 0.3 + big.b * 0.55 + n.b * 0.15) * prof * (0.8 + 0.2 * cover);
        d = (d - 0.47) / 0.45;
        if (fine && d > -0.1) {
          vec4 f = texture(uNoise, q * 0.42 + vec3(0.0, uChurn * 0.045, 0.0));
          d -= (1.0 - f.g) * 0.32 * (1.0 - h * 0.4); // wisps eaten out of the edges
        }
        return max(d, 0.0) * 4.0 * cover;
      }
      void main() {
        vec3 ro = cameraPosition, rd = normalize(vW - cameraPosition);
        vec3 inv = 1.0 / rd;
        vec3 t0 = (uMin - ro) * inv, t1 = (uMax - ro) * inv;
        vec3 tn = min(t0, t1), tf = max(t0, t1);
        float a = max(max(max(tn.x, tn.y), tn.z), 0.0), b = min(min(tf.x, tf.y), tf.z);
        if (b <= a) discard;
        const int STEPS = ${steps};
        float dt = (b - a) / float(STEPS);
        dt = max(dt, 0.08);
        float ign = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
        float tt = a + dt * ign;
        vec3 col = vec3(0.0);
        float T = 1.0;
        for (int i = 0; i < STEPS; i++) {
          if (tt > b || T < 0.02) break;
          vec3 p = ro + rd * tt;
          float hh;
          float d = density(p, hh, true);
          if (d > 0.001) {
            // the dim storm light: grey-blue, lighter on top; under the cloud dark (a
            // glance at the density just above for the self-shadow)
            float hu;
            float above = density(p + vec3(0.0, 0.45, 0.0), hu, false);
            vec3 amb = mix(vec3(0.01, 0.01, 0.018), vec3(0.06, 0.062, 0.085), hh * hh) * exp(-above * 0.9);
            // the bolt's glow from inside
            vec3 uvw = (p - uMin) / (uMax - uMin);
            float L = texture(uLight, uvw).r;
            vec3 lit = amb + uGlow * L;
            float e = exp(-d * dt * 2.2);
            col += T * (1.0 - e) * lit;
            T *= e;
          }
          tt += dt;
        }
        if (T > 0.995) discard;
        gl_FragColor = vec4(col, 1.0 - T);
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 60; // after the bolt: where the cloud is in front of it, it hides it
  // a new bolt: its light baked again a few slices a frame (the whole of it takes about a
  // second), into a buffer of its own, and swapped in whole once done
  let relight = null;
  const glow = mat.uniforms.uGlow.value.clone();
  return {
    mesh,
    bmin,
    bmax,
    // how bright the bolt's glow in it (0 gone … 1 as it holds … more in a flash)
    setGlow(k) {
      mat.uniforms.uGlow.value.copy(glow).multiplyScalar(k);
    },
    // the churning: its clock moved on by dt, `speed` times as fast as the storm's
    churn(dt, turb, speed) {
      mat.uniforms.uChurn.value += dt * speed;
      mat.uniforms.uTurb.value = turb;
    },
    get relighting() {
      return !!relight;
    },
    setChannels(channels) {
      relight = { P: lightPoints(channels, bmin), data: new Uint16Array(light.image.data.length), z: 0 };
    },
    update(budgetMs = 6) {
      if (!relight) return;
      const t0 = performance.now();
      const nz = LIGHT_RES[2];
      while (relight.z < nz && performance.now() - t0 < budgetMs) {
        bakeLight(relight.P, relight.data, bmin, bmax, relight.z, relight.z + 1);
        relight.z++;
      }
      if (relight.z < nz) return;
      light.image.data.set(relight.data);
      light.needsUpdate = true;
      relight = null;
    },
  };
}
