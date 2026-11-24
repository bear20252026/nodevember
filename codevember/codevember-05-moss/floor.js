// The forest floor around the slab: not flat — gentle hummocks and hollows,
// a few roots running under it, soil banked up against the rock, and banks
// rising further off, then fading into the wood behind. On it, things that
// stand up from it: curled dead leaves, twigs, stones, tufts of grass.
import * as THREE from 'three';
import { rng, noise3, fbm, smoothstep, mix } from './noise.js';
import { forestFloorMaterial, plantMaterial, fadeToBack } from './look.js';

const RADIUS = 20;

export function createFloor(support, seed, groundY, back) {
  const n = noise3(seed + 307);
  const n2 = noise3(seed + 311);
  const rand = rng(seed * 733 + 19);
  const disposables = [];
  const group = new THREE.Group();

  // does the rock rise above the base level here?
  const rockAt = (x, z) => support.rockTop(x, z) > groundY;
  // the distance to the rock's outline, roughly: sampled on a ring of directions
  const rockEdge = [];
  for (let i = 0; i < 128; i++) {
    const a = (i / 128) * Math.PI * 2;
    let lo = 0, hi = 4;
    for (let k = 0; k < 16; k++) {
      const m = (lo + hi) / 2;
      if (rockAt(Math.cos(a) * m, Math.sin(a) * m)) lo = m;
      else hi = m;
    }
    rockEdge.push(lo);
  }
  const edgeAt = (x, z) => {
    const a = ((Math.atan2(z, x) / (Math.PI * 2)) * 128 + 128) % 128;
    const i = Math.floor(a), f = a - i;
    return mix(rockEdge[i], rockEdge[(i + 1) % 128], f);
  };

  // the height of the floor
  const height = (x, z) => {
    const r = Math.hypot(x, z);
    const beyond = Math.max(0, r - edgeAt(x, z)); // how far from the rock
    // hummocks and hollows, larger further off
    let h = 0.13 * fbm(n, x * 0.8, 0.3, z * 0.8, 3) + 0.035 * fbm(n2, x * 3.2, 1.7, z * 3.2, 2);
    // roots: ridged noise, raised lines meandering away from the rock
    const ridge = Math.pow(1 - Math.abs(n(x * 1.3 + 7, 2.1, z * 1.3)), 8);
    h += 0.06 * ridge * smoothstep(0.1, 0.6, beyond) * smoothstep(6, 2.5, r);
    // soil and litter banked up against the rock
    h += 0.07 * Math.exp(-beyond / 0.25) * (0.7 + 0.6 * (fbm(n2, x * 2, 5.5, z * 2, 2) * 0.5 + 0.5));
    // further off, banks and slopes rising, hiding the horizon
    h += smoothstep(2.5, 12, r) * (0.45 + 0.6 * fbm(n, x * 0.18 + 3, 8.8, z * 0.18, 3)) * (r * 0.09);
    return groundY + h;
  };
  const normalAt = (x, z, out) => {
    const e = 0.01;
    return out.set(height(x - e, z) - height(x + e, z), 2 * e, height(x, z - e) - height(x, z + e)).normalize();
  };

  // ---- the ground: a polar grid, dense near the rock
  {
    const NR = 150, NA = 300;
    const pos = [], idx = [];
    pos.push(0, height(0, 0) - 0.5, 0);
    for (let j = 1; j <= NR; j++) {
      const r = 0.15 + (RADIUS - 0.15) * Math.pow(j / NR, 2.2);
      for (let i = 0; i < NA; i++) {
        const a = (i / NA) * Math.PI * 2;
        const x = Math.cos(a) * r, z = Math.sin(a) * r;
        pos.push(x, height(x, z), z);
      }
    }
    const ring = (j, i) => (j === 0 ? 0 : 1 + (j - 1) * NA + (i % NA));
    for (let i = 0; i < NA; i++) idx.push(0, ring(1, i + 1), ring(1, i));
    for (let j = 1; j < NR; j++)
      for (let i = 0; i < NA; i++) {
        const a = ring(j, i), b = ring(j, i + 1), c = ring(j + 1, i), d = ring(j + 1, i + 1);
        idx.push(a, b, d, a, d, c);
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const m = forestFloorMaterial(back);
    const ground = new THREE.Mesh(g, m);
    ground.receiveShadow = true;
    group.add(ground);
    disposables.push(g, m);
  }

  // where things lie: around the rock, thinning out with the distance
  const P = new THREE.Vector3(), N = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  const spot = (rMax, out) => {
    for (let k = 0; k < 50; k++) {
      const r = 0.3 + Math.pow(rand(), 1.6) * rMax, a = rand() * Math.PI * 2;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      const y = height(x, z);
      if (support.rockTop(x, z) > y - 0.01) continue; // on the rock, or under it
      return out.set(x, y, z);
    }
    return out.set(0, -10, 0);
  };
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), C = new THREE.Color();
  const lying = (q) => {
    // along the ground, a random turn, a little askew
    normalAt(P.x, P.z, N);
    N.x += (rand() - 0.5) * 0.5;
    N.z += (rand() - 0.5) * 0.5;
    q.setFromUnitVectors(up, N.normalize()).multiply(new THREE.Quaternion().setFromAxisAngle(up, rand() * Math.PI * 2));
    return q;
  };
  const instanced = (geo, mat, count, place) => {
    const m = new THREE.InstancedMesh(geo, mat, count);
    for (let i = 0; i < count; i++) {
      place(i);
      m.setMatrixAt(i, M.compose(P, Q, S));
      m.setColorAt(i, C);
    }
    m.castShadow = m.receiveShadow = true;
    group.add(m);
    fadeToBack(mat, back);
    disposables.push(geo, mat);
    return m;
  };

  // ---- dead leaves: an oval blade, curled up at the edges and along its length
  const leafGeo = (() => {
    const pos = [], col = [], idx = [];
    const ST = 7;
    for (let s = 0; s < ST; s++) {
      const t = s / (ST - 1);
      const w = 0.21 * Math.pow(Math.sin(Math.PI * Math.pow(t, 0.75)), 1.1);
      const x = t - 0.5;
      const lift = 0.12 * (2 * t - 1) ** 2; // curled along
      for (let k = -2; k <= 2; k++) {
        const u = k / 2;
        const curl = 0.18 * u * u * w * 2.2; // edges up
        pos.push(x, lift + curl, u * w);
        const c = k === 0 ? 1.15 : 1 - 0.15 * Math.abs(u);
        col.push(c, c, c);
      }
    }
    for (let s = 0; s < ST - 1; s++)
      for (let k = 0; k < 4; k++) {
        const a = s * 5 + k;
        idx.push(a, a + 5, a + 1, a + 1, a + 5, a + 6);
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  })();
  const leafMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0, side: THREE.DoubleSide });
  const LEAF = [
    [0.26, 0.13, 0.05],
    [0.33, 0.2, 0.07],
    [0.18, 0.1, 0.045],
    [0.4, 0.28, 0.1],
    [0.1, 0.065, 0.035],
    [0.3, 0.25, 0.12],
  ];
  instanced(leafGeo, leafMat, 4200, () => {
    spot(4.5, P);
    lying(Q);
    // some tipped up, resting on others
    if (rand() < 0.25) Q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), (rand() - 0.5) * 0.9));
    const s = 0.05 + Math.pow(rand(), 1.5) * 0.1;
    S.set(s, s * (0.8 + rand() * 0.6), s * (0.7 + rand() * 0.6));
    P.y += 0.004 + rand() * 0.01;
    const c = LEAF[Math.floor(rand() * LEAF.length)];
    C.setRGB(c[0], c[1], c[2]).multiplyScalar(0.75 + rand() * 0.5);
  });

  // ---- stones, half sunk
  const stoneGeo = (() => {
    const g = new THREE.IcosahedronGeometry(1, 2);
    const p = g.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      v.multiplyScalar(1 + 0.3 * n2(v.x * 1.5 + 9, v.y * 1.5, v.z * 1.5) + 0.06 * n(v.x * 5, v.y * 5, v.z * 5));
      p.setXYZ(i, v.x, v.y * 0.65, v.z);
    }
    g.computeVertexNormals();
    return g;
  })();
  instanced(stoneGeo, new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0 }), 140, () => {
    spot(5, P);
    Q.setFromEuler(new THREE.Euler(rand() * 0.5, rand() * 6.3, rand() * 0.5));
    const s = 0.015 + Math.pow(rand(), 2.5) * 0.08;
    S.set(s * (0.8 + rand() * 0.5), s, s * (0.8 + rand() * 0.5));
    P.y += s * 0.05;
    const k = rand();
    C.setRGB(...(k < 0.6 ? [0.2, 0.19, 0.17] : k < 0.85 ? [0.25, 0.21, 0.16] : [0.1, 0.11, 0.08])).multiplyScalar(0.7 + rand() * 0.5);
  });

  // ---- twigs: bent, tapered, some forked, lying along the ground
  {
    const pos = [], col = [], idx = [];
    const SEG = 8, SIDES = 4;
    const T = new THREE.Vector3(), Nn = new THREE.Vector3(), B = new THREE.Vector3(), R = new THREE.Vector3();
    const tube = (pts, r0, c) => {
      const base = pos.length / 3;
      for (let i = 0; i < pts.length; i++) {
        T.subVectors(pts[Math.min(i + 1, pts.length - 1)], pts[Math.max(i - 1, 0)]).normalize();
        Nn.crossVectors(T, up).normalize();
        B.crossVectors(Nn, T);
        const r = r0 * (1 - 0.6 * (i / (pts.length - 1)));
        for (let j = 0; j < SIDES; j++) {
          const a = (j / SIDES) * Math.PI * 2;
          R.copy(Nn).multiplyScalar(Math.cos(a)).addScaledVector(B, Math.sin(a));
          pos.push(pts[i].x + R.x * r, pts[i].y + R.y * r, pts[i].z + R.z * r);
          const k = 0.75 + 0.35 * Math.sin(i * 1.7 + j);
          col.push(c.r * k, c.g * k, c.b * k);
        }
      }
      for (let i = 0; i < pts.length - 1; i++)
        for (let j = 0; j < SIDES; j++) {
          const a = base + i * SIDES + j, b = base + i * SIDES + ((j + 1) % SIDES);
          idx.push(a, b + SIDES, b, a, a + SIDES, b + SIDES);
        }
    };
    // a line along the ground from (x, z) heading a, with a gentle bend
    const line = (x, z, a, len, r) => {
      const pts = [];
      const bend = (rand() - 0.5) * 1.2;
      for (let i = 0; i <= SEG; i++) {
        const s = i / SEG;
        const aa = a + bend * s;
        if (i > 0) {
          x += Math.cos(aa) * len / SEG;
          z += Math.sin(aa) * len / SEG;
        }
        pts.push(new THREE.Vector3(x, Math.max(height(x, z), rockAt(x, z) ? support.rockTop(x, z) : -9) + r * 0.8, z));
      }
      return pts;
    };
    const c = new THREE.Color();
    for (let k = 0; k < 130; k++) {
      spot(5, P);
      const a = rand() * Math.PI * 2, len = 0.12 + Math.pow(rand(), 1.5) * 0.5, r = 0.004 + rand() * 0.008;
      c.setRGB(...(rand() < 0.7 ? [0.16, 0.12, 0.09] : [0.25, 0.22, 0.18])).multiplyScalar(0.7 + rand() * 0.5);
      const pts = line(P.x, P.z, a, len, r);
      tube(pts, r, c);
      if (rand() < 0.4) {
        const f = pts[Math.floor(SEG * (0.3 + rand() * 0.4))];
        tube(line(f.x, f.z, a + (rand() < 0.5 ? 0.6 : -0.6), len * 0.4, r * 0.6), r * 0.6, c);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const m = fadeToBack(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0 }), back);
    const twigs = new THREE.Mesh(g, m);
    twigs.castShadow = twigs.receiveShadow = true;
    group.add(twigs);
    disposables.push(g, m);
  }

  // ---- a few big stones, deeply sunk, a little way off
  instanced(stoneGeo.clone(), new THREE.MeshStandardMaterial({ roughness: 0.92, metalness: 0 }), 5, (i) => {
    for (let k = 0; k < 50; k++) {
      const a = rand() * Math.PI * 2, r = 2.2 + rand() * 2.5;
      P.set(Math.cos(a) * r, 0, Math.sin(a) * r);
      if (!rockAt(P.x, P.z)) break;
    }
    P.y = height(P.x, P.z);
    Q.setFromEuler(new THREE.Euler(rand() * 0.4, rand() * 6.3, rand() * 0.4));
    const s = 0.15 + rand() * 0.22;
    S.set(s * (1 + rand() * 0.6), s * 0.8, s * (0.8 + rand() * 0.5));
    P.y -= s * 0.25;
    C.setRGB(0.24, 0.23, 0.21).multiplyScalar(0.7 + rand() * 0.4);
  });

  // ---- a fallen branch behind, half sunk in the litter, mossy on top
  {
    const a0 = Math.PI * (1.25 + rand() * 0.5); // behind, seen from the front
    const cx = Math.cos(a0) * (2.6 + rand() * 0.8), cz = Math.sin(a0) * (2.6 + rand() * 0.8);
    const dirA = a0 + Math.PI / 2 + (rand() - 0.5) * 0.6;
    const len = 2.6 + rand() * 1.0, R0 = 0.085 + rand() * 0.035;
    const SEG = 24, SIDES = 14;
    const pos = [], col = [], idx = [];
    const T = new THREE.Vector3(), Nn = new THREE.Vector3(), B = new THREE.Vector3(), Rv = new THREE.Vector3();
    const pts = [];
    for (let i = 0; i <= SEG; i++) {
      const s = i / SEG - 0.5;
      const aa = dirA + 0.08 * s;
      const x = cx + Math.cos(aa) * s * len, z = cz + Math.sin(aa) * s * len;
      pts.push(new THREE.Vector3(x, height(x, z), z));
    }
    // rigid: it rests on a smooth line through the ground, not on every bump
    const hs = pts.map((p) => p.y);
    pts.forEach((p, i) => {
      let sum = 0, w = 0;
      for (let k = 0; k <= SEG; k++) {
        const g = Math.exp(-(((k - i) / 6) ** 2));
        sum += hs[k] * g;
        w += g;
      }
      p.y = Math.max(sum / w, hs[i] - R0 * 0.3) + R0 * 0.75;
    });
    for (let i = 0; i <= SEG; i++) {
      T.subVectors(pts[Math.min(i + 1, SEG)], pts[Math.max(i - 1, 0)]).normalize();
      Nn.crossVectors(T, up).normalize();
      B.crossVectors(Nn, T);
      const r = R0 * (1 - 0.35 * (i / SEG)) * (1 + 0.08 * Math.sin(i * 2.3)) * (i === 0 || i === SEG ? 0.75 : 1);
      for (let j = 0; j < SIDES; j++) {
        const an = (j / SIDES) * Math.PI * 2;
        Rv.copy(Nn).multiplyScalar(Math.cos(an)).addScaledVector(B, Math.sin(an));
        const p = pts[i];
        pos.push(p.x + Rv.x * r, p.y + Rv.y * r, p.z + Rv.z * r);
        // bark below, moss over the top
        const top = smoothstep(0.45, 0.85, Rv.y + 0.25 * n(p.x * 6, j * 0.5, p.z * 6)) * smoothstep(0.5, 0.7, n(p.x * 2.5, p.z * 2.5, 4.4) * 0.5 + 0.5) * 0.85;
        // bark furrows along its length, darker underneath (in its own shade)
        const furrow = 0.65 + 0.35 * Math.abs(Math.sin(j * 2.1 + n2(p.x * 4, j, p.z * 4) * 2));
        const k = (0.8 + 0.35 * n2(p.x * 9, j * 0.7, p.z * 9)) * furrow * mix(0.35, 1.1, smoothstep(-0.7, 0.6, Rv.y));
        const c = new THREE.Color(0.17, 0.13, 0.09).lerp(new THREE.Color(0.09, 0.17, 0.03), top).multiplyScalar(k);
        col.push(c.r, c.g, c.b);
      }
    }
    for (let i = 0; i < SEG; i++)
      for (let j = 0; j < SIDES; j++) {
        const a = i * SIDES + j, b = i * SIDES + ((j + 1) % SIDES);
        idx.push(a, b + SIDES, b, a, a + SIDES, b + SIDES);
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const m = fadeToBack(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0 }), back);
    const branch = new THREE.Mesh(g, m);
    branch.castShadow = branch.receiveShadow = true;
    group.add(branch);
    disposables.push(g, m);
  }

  // ---- tufts of grass and sedge: thin curved blades from a point, green
  // with some dry ones, more of them further off
  {
    const pos = [], col = [], idx = [];
    const c = new THREE.Color(), dir = new THREE.Vector3(), side = new THREE.Vector3(), p = new THREE.Vector3();
    for (let k = 0; k < 170; k++) {
      spot(6.5, P);
      if (Math.hypot(P.x, P.z) < 1.2 && rand() < 0.7) continue;
      const blades = 8 + Math.floor(rand() * 12);
      const tall = 0.1 + rand() * 0.25;
      const dry = rand() < 0.3;
      for (let b = 0; b < blades; b++) {
        const az = rand() * Math.PI * 2, lean = 0.15 + rand() * 0.6, droop = 0.4 + rand() * 1.0;
        const len = tall * (0.6 + rand() * 0.6), w = 0.004 + rand() * 0.003;
        const out = new THREE.Vector3(Math.cos(az), 0, Math.sin(az));
        side.set(-out.z, 0, out.x);
        p.set(P.x + out.x * 0.01, P.y - 0.01, P.z + out.z * 0.01);
        const base = pos.length / 3;
        const ST = 5;
        const dead = dry || rand() < 0.15;
        for (let s = 0; s < ST; s++) {
          const t = s / (ST - 1);
          const a = lean + droop * t * t;
          dir.copy(up).multiplyScalar(Math.cos(a)).addScaledVector(out, Math.sin(a));
          if (s > 0) p.addScaledVector(dir, len / (ST - 1));
          const ww = w * (1 - t * 0.9);
          pos.push(p.x - side.x * ww, p.y, p.z - side.z * ww, p.x + side.x * ww, p.y, p.z + side.z * ww);
          if (dead) c.setRGB(0.3, 0.24, 0.12).lerp(new THREE.Color(0.45, 0.38, 0.2), t);
          else c.setRGB(0.05, 0.09, 0.02).lerp(new THREE.Color(0.2, 0.32, 0.07), Math.min(1, t * 1.5)).lerp(new THREE.Color(0.38, 0.42, 0.15), t * t * 0.6);
          col.push(c.r, c.g, c.b, c.r, c.g, c.b);
        }
        for (let s = 0; s < ST - 1; s++) {
          const a = base + s * 2;
          idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const m = fadeToBack(plantMaterial({ roughness: 0.6, through: 0xc8e070, amount: 0.9 }), back);
    const grass = new THREE.Mesh(g, m);
    grass.castShadow = grass.receiveShadow = true;
    group.add(grass);
    disposables.push(g, m);
  }

  return { group, height, dispose: () => disposables.forEach((d) => d.dispose()) };
}
