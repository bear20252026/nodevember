import { BoxGeometry, Float32BufferAttribute, Vector3 } from 'three/webgpu';
import { mergeVertices } from './vendor/mergeVertices.js';
import { randomSeed, noise, fbm, smoothstep } from './noise.js';
import { bakeCurvature } from './curvature.js';
import { createRockCuts, carveRadius, erosionField } from './rock-shaping.js';

// Fractures are finite, oblique planes with independent lengths and depths.
// They interrupt sediment beds without imposing a repeated cellular grid.
export function sampleSediment(level, beds) {
  const bed = beds.find(b => level < b.top) || beds[beds.length - 1];
  const fraction = (level - bed.bottom) / (bed.top - bed.bottom), hardness = bed.hardness;
  const boundary = Math.min(fraction, 1 - fraction);
  const seam = (1 - smoothstep(.01, .18, boundary)) * (.0015 + hardness * .004);
  const ledge = smoothstep(.08, .28, fraction) * (1 - smoothstep(.65, .96, fraction)) * hardness * .003;
  return { hardness, seam, ledge };
}

export function createRockGeometry(seed, kind = 'boulder', segments = 64) {
  const random = randomSeed(seed), planes = [], shelf = kind === 'shelf', cliff = kind === 'cliff' || kind === 'distant' || shelf;
  const family = Math.floor(seed / 7919) % 4;
  const cuts = createRockCuts(seed, cliff, shelf);
  for (let axis = 0; axis < 3; axis++) for (const sign of [-1, 1]) {
    // Bedding caps dip gently; steeply tilted top/bottom cuts produced too
    // many pointed wedges when neighboring masses were assembled into cliffs.
    const slope = cliff ? (axis === 1 ? .18 + family * .07 : family === 2 ? .55 : .34) : .7;
    const n = new Vector3((random() - .5) * slope, (random() - .5) * slope, (random() - .5) * slope);
    n.setComponent(axis, sign); n.normalize();
    planes.push([n, .71 + random() * .32]);
  }
  for (let i = 0; i < 12; i++) {
    const n = new Vector3(random() * 2 - 1, random() * 2 - 1, random() * 2 - 1).normalize();
    planes.push([n, (cliff ? .78 : .69) + random() * .35]);
  }
  let geometry = new BoxGeometry(2, 2, 2, segments, segments, segments);
  geometry.deleteAttribute('uv'); geometry.deleteAttribute('normal'); geometry.clearGroups();
  const source = geometry; geometry = mergeVertices(source); source.dispose();
  const p = geometry.attributes.position, weathering = new Float32Array(p.count), sediment = new Float32Array(p.count), strata = new Float32Array(p.count * 2), d = new Vector3();
  const offset = seed % 997;
  const dipX = (random() - .5) * .14, dipZ = (random() - .5) * .1;
  const lean = (random() - .5) * .16;
  const beds = [];
  for (let bottom = -3; bottom < 3;) {
    const thickness = (shelf ? .15 : cliff ? .035 : .09) + Math.pow(random(), 1.6) * (shelf ? .35 : cliff ? .20 : .32);
    beds.push({ bottom, top: bottom + thickness, hardness: random() });
    bottom += thickness;
  }
  const fractures = Array.from({ length: cliff ? 5 : 3 }, () => {
    const a = random() * Math.PI * 2;
    return { nx: Math.cos(a), nz: Math.sin(a), dip: (random() - .5) * .65,
      offset: (random() - .5) * 1.3, width: .014 + random() * .032,
      depth: .018 + random() * .042, center: (random() - .5) * 1.6,
      reach: .35 + random() * .9 };
  });
  const scars = Array.from({ length: 7 }, () => {
    const a = random() * Math.PI * 2;
    return { x: Math.cos(a) * .84, z: Math.sin(a) * .84, y: (random() - .5) * 1.8,
      radius: .18 + random() * .35, depth: .035 + random() * .09 };
  });
  for (let i = 0; i < p.count; i++) {
    d.fromBufferAttribute(p, i).normalize();
    let radius = 3;
    for (const [n, distance] of planes) { const dot = d.dot(n); if (dot > .001) radius = Math.min(radius, distance / dot); }
    radius = carveRadius(d.x, d.y, d.z, radius, cuts);
    let x = d.x * radius, y = d.y * radius, z = d.z * radius;
    // Bedding stays almost planar. Unequal bed thickness and hardness control
    // recessed shale seams and projecting sandstone ledges independently.
    const level = y + x * dipX + z * dipZ + noise(x * 2 + offset, 0, z * 2) * .012;
    const { hardness, seam } = sampleSediment(level, beds);
    strata[i * 2] = (level + 3) / 6;
    strata[i * 2 + 1] = (Math.floor(seed / 7919) + .5) / 32;
    // Softer beds erode unevenly along the face; no projecting caps or
    // discrete rings are added around the rock.
    const exposure = .4 + .6 * smoothstep(-.5, .5, noise(x * 2.1 + offset, y * .9, z * 2.1));
    const recession = (1 - hardness) * .034 * exposure;
    let cut = 0;
    for (const f of fractures) {
      const distance = Math.abs(x * f.nx + z * f.nz + y * f.dip - f.offset + noise(x * 7 + offset, y * 6, z * 7) * .012);
      const extent = 1 - smoothstep(f.reach * .4, f.reach, Math.abs(y - f.center));
      cut = Math.max(cut, (1 - smoothstep(0, f.width, distance)) * f.depth * extent);
    }
    let spall = 0;
    for (const scar of scars) {
      const distance = Math.abs(x - scar.x) + Math.abs(z - scar.z) + Math.abs(y - scar.y) * .7;
      spall = Math.max(spall, Math.max(0, 1 - distance / scar.radius) * scar.depth);
    }
    const broad = fbm(x * 2.8 + offset, y * 1.9, z * 2.8, 2);
    const broken = erosionField(x * 4.2, y * 6.1, z * 4.2, offset);
    // Fine mineral grain belongs to the material: geometric noise above the
    // mesh's sampling rate only makes lumpy, unstable silhouettes and normals.
    const undercut = (1 - smoothstep(-.8, .4, y)) * (.025 + broad * .03);
    const fractureEdge = Math.min(1, cut * 12 + spall * 6);
    const erosion = broad * .018 - broken * (.035 + fractureEdge * .045) - seam * exposure - cut - spall - recession - undercut;
    const factor = 1 + erosion;
    x *= factor; z *= factor;
    y += d.y * (broad * .022 - broken * .035);
    if (cliff) {
      const taper = smoothstep(-.15, 1.2, y);
      x *= 1 - taper * [.05, .10, .18, .12][family];
      z *= 1 - taper * [.05, .08, .13, .16][family];
      x += y * lean; z += y * dipZ;
    }
    p.setXYZ(i, x, y, z);
    weathering[i] = Math.max(.35, Math.min(1, .98 - seam * 3 - cut * 3 - spall * 2 - broken * .3));
    sediment[i] = hardness * .65 + (.5 + broad) * .35;
  }
  geometry.setAttribute('weathering', new Float32BufferAttribute(weathering, 1));
  geometry.setAttribute('sediment', new Float32BufferAttribute(sediment, 1));
  geometry.setAttribute('strata', new Float32BufferAttribute(strata, 2));
  geometry.userData.beds = beds;
  // Silhouette error alone permits visible triangular shading patches on
  // small eroded faces. Retain finer meshlet levels for their normal changes.
  geometry.userData.meshletErrorScale = kind === 'distant' ? 1 : kind === 'boulder' ? 3 : 2;
  geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  geometry.setAttribute('curvature', new Float32BufferAttribute(bakeCurvature(p.array, geometry.index.array, geometry.attributes.normal.array), 1));
  geometry.name = `${kind} / ${seed} / ${geometry.index.count / 3} triangles`;
  return geometry;
}

export function createMasonryGeometry(seed) {
  const geometry = new BoxGeometry(1, 1, 1, 5, 5, 5); geometry.clearGroups();
  const p = geometry.attributes.position;
  const v = new Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const x = v.x, y = v.y, z = v.z;
    v.clampScalar(-.47, .47);
    const bevel = new Vector3(x, y, z).sub(v).normalize().multiplyScalar(.03);
    v.add(bevel).multiplyScalar(1 + fbm(x * 9 + seed, y * 9, z * 9, 3) * .028);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geometry.computeVertexNormals(); geometry.computeBoundingSphere();
  return geometry;
}
