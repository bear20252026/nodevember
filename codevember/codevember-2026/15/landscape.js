import { BundleGroup, InstancedMesh, Mesh, Object3D, PlaneGeometry, BufferGeometry, Float32BufferAttribute, Color } from 'three/webgpu';
import { stitchTerrainEdge } from './terrain-stitch.js';
import { createRockGeometry } from './rock-geometry.js';
import { createIslandBedrock } from './island-bedrock.js';
import { createDesertGrass } from './desert-grass.js';
import { cathedral } from './world-layout.js';
import { randomSeed, noise, smoothstep, terrainHeight, canyonCenter, canyonWidth } from './noise.js';

export async function createLandscape(scene, materials, reportProgress = () => {}) {
  const group = new BundleGroup(); group.name = 'Eroded sandstone canyon';
  const random = randomSeed(151515), dummy = new Object3D(), variants = [], transforms = [], batches = [], obstacles = [], collisionGeometry = [], smallCollisionGeometry = [];
  const specs = [...Array.from({ length: 8 }, () => ['cliff', 112]), ...Array.from({ length: 8 }, () => ['boulder', 64]), ...Array.from({ length: 4 }, () => ['scree', 20]), ...Array.from({ length: 4 }, () => ['shelf', 80]), ...Array.from({ length: 8 }, () => ['distant', 16])];
  let lastYield = performance.now();
  for (let i = 0; i < specs.length; i++) {
    reportProgress(i / specs.length * .35, `Eroding sandstone · ${i + 1} / ${specs.length}`);
    if (performance.now() - lastYield > 12) {
      await new Promise(requestAnimationFrame);
      lastYield = performance.now();
    }
    variants.push(createRockGeometry(151 + i * 7919, ...specs[i])); transforms.push([]);
    materials.registerRock(variants[i], i);
    collisionGeometry.push(i < 24 ? createRockGeometry(151 + i * 7919, specs[i][0], 24) : null);
    smallCollisionGeometry.push(i < 24 ? createRockGeometry(151 + i * 7919, specs[i][0], 8) : null);
    variants[i].computeBoundingBox();
  }
  reportProgress(.35, 'Shaping the canyon…'); await new Promise(requestAnimationFrame);
  function rock(index, x, y, z, sx, sy, sz, ry = 0, tilt = .04, shapeRandom = random) {
    dummy.position.set(x, y, z); dummy.scale.set(sx, sy, sz);
    dummy.rotation.set((shapeRandom() - .5) * tilt, ry, (shapeRandom() - .5) * tilt); dummy.updateMatrix();
    // Gravel already has a buried center and can rest on a few contact points.
    // Fitting its entire underside to a dune would swallow the small stones.
    const groundStone = index >= 8 && Math.max(sx, sy, sz) > 2 && y - terrainHeight(x, z) < sy * .6;
    if (index >= 24 || groundStone) {
      // Ground stones and broad outcrops intersect the downhill side too;
      // placing only their center left slabs hovering above steep flanks.
      const b = variants[index].boundingBox, e = dummy.matrix.elements;
      let support = 0;
      for (const px of [b.min.x, b.max.x]) for (const pz of [b.min.z, b.max.z]) {
        const xx = e[0] * px + e[4] * b.min.y + e[8] * pz + e[12];
        const yy = e[1] * px + e[5] * b.min.y + e[9] * pz + e[13];
        const zz = e[2] * px + e[6] * b.min.y + e[10] * pz + e[14];
        support = Math.min(support, terrainHeight(xx, zz) - yy - sy * .08);
      }
      // The bounding box includes empty corners on a tapered rock. Seat the
      // actual lower hull as well, so a broad slab cannot bridge empty air.
      const p = (collisionGeometry[index] || variants[index]).attributes.position;
      for (let i = 0; i < p.count; i++) {
        if (p.getY(i) > b.min.y + (b.max.y - b.min.y) * .22) continue;
        const px = p.getX(i), py = p.getY(i), pz = p.getZ(i);
        const xx = e[0] * px + e[4] * py + e[8] * pz + e[12];
        const yy = e[1] * px + e[5] * py + e[9] * pz + e[13];
        const zz = e[2] * px + e[6] * py + e[10] * pz + e[14];
        support = Math.min(support, terrainHeight(xx, zz) - yy - sy * .18);
      }
      dummy.position.y += support; dummy.updateMatrix();
    }
    transforms[index].push(dummy.matrix.clone());
    // Gravel below the tire's scale stays decorative. Every larger stone,
    // including low shelves and loose boulders, participates in contact.
    if (index < 24 && Math.max(sx, sz) > .23 && sy > .12 && z > -1700 && z < 600) {
      const e = dummy.matrix.elements, bounds = variants[index].boundingBox;
      const ex = Math.max(Math.abs(bounds.min.x), Math.abs(bounds.max.x)), ey = Math.max(Math.abs(bounds.min.y), Math.abs(bounds.max.y)), ez = Math.max(Math.abs(bounds.min.z), Math.abs(bounds.max.z));
      const geometry = Math.max(sx, sy, sz) <= 3 ? smallCollisionGeometry[index] : collisionGeometry[index];
      obstacles.push({ x, z, rx: Math.abs(e[0]) * ex + Math.abs(e[4]) * ey + Math.abs(e[8]) * ez,
        rz: Math.abs(e[2]) * ex + Math.abs(e[6]) * ey + Math.abs(e[10]) * ez,
        top: dummy.position.y + Math.abs(e[1]) * ex + Math.abs(e[5]) * ey + Math.abs(e[9]) * ez,
        variant: index, instance: transforms[index].length - 1,
        matrix: [...e], positions: geometry.attributes.position.array, indices: geometry.index.array });
    }
  }
  // Neighboring masses share a slowly varying height and bedding direction.
  // Broad overlapping backs, fractured faces, then low ledges create connected
  // formations; detached debris follows their erosion channels below.
  for (const side of [-1, 1]) {
    for (let k = 0; k < 24; k++) {
      const z = 170 - k * 44;
      // Break the rim into headlands and open saddles. Beyond the island,
      // the basin widens so successive mountain ranges remain visible.
      if (k > 8 && (k + (side < 0 ? 2 : 0)) % 7 < 3) continue;
      const edge = canyonCenter(z) + side * (canyonWidth(z) + Math.max(0, -z - 250) * .5);
      const height = (48 + noise(z * .009, side * 17, 5) * 26) * (side < 0 ? .65 : .85) * (k > 12 ? .6 : 1);
      const x = edge + side * 35, base = terrainHeight(x, z) - 12;
      rock(k % 8, x + side * 32, base + height * .36, z - 6, 48 + random() * 18, height * .62, 40 + random() * 13, (random() - .5) * .18, .06);
      rock((k + 3) % 8, x, base + height * .33, z + 3, 30 + random() * 13, height * .57, 30 + random() * 10, (random() - .5) * .22, .08);
      for (let j = 0; j < 2; j++) {
        const bz = z + (j - .5) * 22, bx = edge + side * (10 + random() * 6);
        rock((k + j + 1) % 8, bx, base + height * .24, bz, 14 + random() * 9, height * (.3 + random() * .12), 17 + random() * 8, (random() - .5) * .3, .1);
      }
      rock(20 + k % 4, edge - side * 5, terrainHeight(edge - side * 5, z) + 2, z + 12, 19 + random() * 8, 6 + random() * 4, 25, (random() - .5) * .25, .08);
    }
    // Wide, grounded ridges carry the geology toward the horizon.
    for (let k = 0; k < 6; k++) {
      const z = -580 - k * 105, x = side * (470 + random() * 220);
      const height = 24 + random() * 43;
      rock(k % 8, x, terrainHeight(x, z) + height * .26, z, 45 + random() * 40, height, 43 + random() * 35, (random() - .5) * .5, .16);
    }
  }
  // A few isolated geological landmarks punctuate the open plain. Mountains
  // belong to the continuous heightfield, not an array of enlarged boulders.
  const landmarks = [
    [-1050, -2400, 160, 210, 2], [1600, -3700, 240, 280, 6],
    [-6500, -4000, 350, 180, 0], [4100, -8500, 400, 270, 3],
    [-5400, -13200, 500, 370, 2], [8500, -17500, 650, 390, 5],
    [-12000, -27000, 850, 440, 1], [19000, -42000, 1100, 650, 6]
  ];
  for (const [x, z, width, height, variant] of landmarks) {
    rock(24 + variant, x, terrainHeight(x, z) + height * .24, z, width, height, width * 1.4, -.25 + random() * .5, .15);
    rock(24 + (variant + 3) % 8, x + width * .6, terrainHeight(x + width * .6, z) + height * .1, z + width * .3, width * .6, height * .45, width * .7, random() * .5, .08);
  }
  // Sparse, widely separated mesas. Keep a broad sightline behind the
  // sanctuary so the eye follows the land all the way into the atmosphere.
  for (let i = 0; i < 34; i++) {
    const z = -2200 - Math.pow(random(), 1.6) * 70000;
    const side = i % 2 ? -1 : 1, x = side * (900 + random() * -z * .9);
    const size = 90 + -z * .007 + random() * 160;
    const height = size * (.25 + random() * .4);
    rock(24 + i % 8, x, terrainHeight(x, z) + height * .3, z, size, height, size * (1 + random()), random() * 1.2, .12);
  }
  // The cathedral grows from a single broad island of fractured sandstone.
  const cx = cathedral.x, cz = cathedral.z;
  const bedrock = new Mesh(createIslandBedrock(variants[0].userData.beds), materials.rock);
  bedrock.name = 'Sanctuary bedrock foundation'; bedrock.position.set(cx, 0, cz); bedrock.scale.setScalar(40); bedrock.updateMatrix();
  bedrock.castShadow = bedrock.receiveShadow = true; bedrock.frustumCulled = false; group.add(bedrock);
  const bedrockCollision = createIslandBedrock(variants[0].userData.beds, 24);
  obstacles.push({ x: cx, z: cz - 8, rx: 115, rz: 95, top: 51,
    matrix: [...bedrock.matrix.elements], positions: bedrockCollision.attributes.position.array, indices: bedrockCollision.index.array });
  const islandStart = transforms.map(list => list.length);
  rock(0, cx - 25, 18, cz, 64, 30, 63, .12, .035);
  rock(3, cx + 36, 19, cz - 14, 43, 40, 51, -.18, .04);
  rock(5, cx - 61, 12, cz + 24, 27, 29, 43, .22, .03);
  rock(1, cx + 64, 22, cz - 24, 25, 44, 39, -.1, .03);
  rock(2, cx + 30, 37, cz - 67, 27, 70, 30, -.2, .06);
  rock(3, cx - 67, 18, cz - 9, 43, 43, 59, -.15, .04);
  rock(5, cx + 76, 20, cz - 32, 45, 46, 55, .24, .04);
  rock(2, cx + 46, 53, cz - 92, 49, 96, 54, -.25, .12);
  for (let i = 0; i < 11; i++) {
    const a = i / 11 * Math.PI * 2, x = cx + Math.cos(a) * 65, z = cz + Math.sin(a) * 57;
    rock(20 + i % 4, x, 3 + random() * 6, z, 22 + random() * 12, 7 + random() * 7, 20 + random() * 12, a, .05);
  }
  // Smaller attached blocks break up the continuous foundation's exposed
  // front and side faces. They overlap the shelf and extend into the sand,
  // rather than leaving the sanctuary balanced on a few tapered boulders.
  const buttresses = [
    [3, -37, 14, 55, 25, 25, 18, .12], [0, 36, 15, 53, 27, 27, 21, -.1],
    [6, -72, 17, 27, 26, 33, 24, .1], [5, 76, 18, 19, 27, 35, 26, -.16],
    [1, -101, 17, -16, 18, 34, 28, .2], [3, 101, 18, -28, 20, 35, 28, -.15],
    [20, -43, 5, 72, 25, 10, 21, .15], [22, 42, 5, 69, 29, 10, 23, -.1],
    [21, -91, 1, 37, 24, 9, 26, .15], [23, 96, 1, 25, 23, 10, 29, -.2],
    [8, -112, 7, 4, 14, 13, 13, .7], [11, -112, 8, -40, 15, 14, 18, -.3],
    [10, -83, 6, 55, 13, 11, 14, .9], [13, -51, 3, 82, 13, 7, 11, .2],
    [12, 114, 7, -11, 14, 12, 17, -.5], [14, 91, 5, 49, 15, 10, 14, .6],
    [9, 65, 4, 72, 12, 8, 14, -.2], [15, 32, 2, 86, 12, 6, 11, .6]
  ];
  for (const [variant, x, y, z, sx, sy, sz, rotation] of buttresses) rock(variant, cx + x, y, cz + z, sx, sy, sz, rotation, .035);
  // Break the exposed island into overlapping, individually eroded blocks.
  // The backing shelf remains inside: only its load-bearing crown meets the
  // masonry. Staggered joints, ledges and broken toes replace smooth skirts.
  const islandRandom = randomSeed(151590);
  let islandBlocks = 0;
  for (let side = 0; side < 4; side++) for (let layer = 0; layer < 3; layer++) {
    const span = side % 2 ? 105 : 210;
    let along = -span / 2 - (layer % 2) * 9;
    while (along < span / 2) {
      const width = 15 + islandRandom() * 14, center = along + width * .5;
      along += width * (.57 + islandRandom() * .12);
      const u = Math.max(-span / 2, Math.min(span / 2, center));
      let x = side === 0 ? u : side === 1 ? 106 : side === 2 ? -u : -106;
      let z = side === 0 ? 58 - smoothstep(48, 88, Math.abs(x)) * 40 : side === 2 ? -80 : u - 28;
      if (side === 0 && Math.abs(x) - width * .6 < 19) continue; // Keep the entire rock outside the stairs.
      const nx = side === 1 ? 1 : side === 3 ? -1 : 0, nz = side === 0 ? 1 : side === 2 ? -1 : 0;
      const crown = 36.9 + smoothstep(45, 54, Math.abs(x)) * 13.5;
      const bottom = layer === 0 ? -5 : layer === 1 ? 7 + islandRandom() * 4 : crown * .48;
      const top = layer === 0 ? 15 + islandRandom() * 6 : layer === 1 ? crown * .73 : crown - .65;
      const depth = 16 + islandRandom() * 12, outward = 4 + islandRandom() * 5 + (2 - layer) * 3;
      x += nx * outward; z += nz * outward;
      const variant = (islandBlocks + layer * 3) % 5 === 0 ? 8 + islandBlocks % 8 : islandBlocks % 8;
      const b = variants[variant].boundingBox;
      const sx = width / (b.max.x - b.min.x), sy = (top - bottom) / (b.max.y - b.min.y), sz = depth / (b.max.z - b.min.z);
      rock(variant, cx + x, top - b.max.y * sy, cz + z, sx, sy, sz, side * Math.PI / 2 + (islandRandom() - .5) * .28, .04, islandRandom);
      if (layer === 2) {
        // Deep, inset shoulder blocks fill gaps under the foundation. These
        // overlap the cliff bodies instead of making thin projecting shelves.
        const cap = 8 + islandBlocks % 8, capBounds = variants[cap].boundingBox;
        const capHeight = 13 + islandRandom() * 5, capScale = capHeight / (capBounds.max.y - capBounds.min.y);
        rock(cap, cx + x - nx * 5, crown - .2 - capBounds.max.y * capScale, cz + z - nz * 5,
          width / (capBounds.max.x - capBounds.min.x), capScale, depth * .9 / (capBounds.max.z - capBounds.min.z),
          side * Math.PI / 2 + (islandRandom() - .5) * .15, .02, islandRandom);
      }
      islandBlocks++;
    }
  }
  // Rasterize the island's real upper surfaces once, then settle fragments on
  // exposed ledges. Sampling terrain alone buries them under the formation.
  const islandSurface = rasterizeRockSurface([...variants, bedrock.geometry], [...transforms.map((list, i) => list.slice(islandStart[i])), [bedrock.matrix]], cx, cz);
  let islandFragments = 0;
  for (let attempt = 0; attempt < 20000 && islandFragments < 700; attempt++) {
    const x = cx - 125 + random() * 250, z = cz - 145 + random() * 250;
    const dx = x - cx, dz = z - cz;
    if ((Math.abs(dx) < 94 && dz > -80 && dz < 48) || (Math.abs(dx) < 17 && dz > 35)) continue;
    const y = islandSurface(x, z), floor = terrainHeight(x, z);
    if (!Number.isFinite(y) || y < floor + 1 || y > 65) continue;
    const slope = Math.max(Math.abs(islandSurface(x + 1, z) - y), Math.abs(islandSurface(x, z + 1) - y));
    if (!Number.isFinite(slope) || slope > 1.2) continue;
    const size = .16 + Math.pow(random(), 2.5) * 2.4;
    rock(islandFragments % 5 === 0 ? 8 + islandFragments % 8 : 16 + islandFragments % 4, x, y + size * .08, z, size, size * .5, size * 1.25, random() * 6.28, .9);
    islandFragments++;
  }
  for (let i = 0; i < 650; i++) {
    const a = random() * Math.PI * 2, r = 72 + random() * 44, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r * .75;
    const size = .15 + Math.pow(random(), 3) * 3.5;
    rock(i < 220 ? 8 + i % 8 : 16 + i % 4, x, terrainHeight(x, z) + size * .13, z, size, size * .6, size * 1.2, random() * 6.28, 1.4);
  }
  // Deliberate hero formations frame the view without sealing the valley.
  rock(1, 238, 31, 45, 47, 52, 48, -.1, .06);
  rock(4, 221, 15, 88, 35, 25, 31, .12, .08);
  rock(3, -248, 23, 22, 51, 35, 50, .1, .08);
  rock(2, 361, 36, -340, 65, 67, 71, -.14, .14);
  rock(6, -390, 22, -390, 87, 50, 80, .12, .16);
  rock(10, -8, terrainHeight(-8, 91) + 1.5, 91, 4.8, 3.1, 4, .35, .1);
  rock(12, -2, terrainHeight(-2, 87) + .8, 87, 2.8, 1.8, 2.1, 2, .3);
  // A weathered outcrop exposes strata at human scale along the canyon toe.
  const outcropY = terrainHeight(48, 68);
  rock(2, 48, outcropY + 6.7, 68, 5.4, 8.7, 5, .18, .04);
  rock(5, 54, outcropY + 4, 66, 4.8, 6.8, 4.5, -.15, .06);
  rock(6, 43, outcropY + 3.5, 67, 3.2, 5.6, 3.7, -.32, .08);
  rock(11, 47, outcropY + .8, 71, 5.2, 2.3, 4.6, .2, .06);
  rock(10, 41, terrainHeight(41, 75) + .8, 75, 3, 2.1, 2.7, .5, .65);
  rock(13, 55, terrainHeight(55, 75) + .6, 75, 2.8, 1.8, 2.4, 2.1, .5);
  for (let i = 0; i < 550; i++) {
    const a = random() * Math.PI * 2, r = 7 + random() * 18;
    const x = 48 + Math.cos(a) * r, z = 68 + Math.sin(a) * r;
    const size = i < 90 ? .35 + random() * 1.3 : .07 + random() * .5;
    rock(i < 90 ? 8 + i % 8 : 16 + i % 4, x, terrainHeight(x, z) + size * .12, z, size * (1 + random() * .5), size * .45, size, random() * 6.28, 1.2);
  }
  const fans = Array.from({ length: 64 }, (_, i) => {
    const z = 150 - random() * 1080, side = i % 2 ? -1 : 1;
    return { z, side, x: canyonCenter(z) + side * (canyonWidth(z) - 7), spread: 9 + random() * 17 };
  });
  for (let i = 0; i < 1500; i++) {
    const fan = fans[i % fans.length], runout = random(), z = fan.z + (random() - .5) * fan.spread * 2;
    const x = fan.x - fan.side * runout * fan.spread;
    const size = (.55 + Math.pow(random(), 2.2) * 5.6) * (1 - runout * .45);
    rock(8 + i % 8, x, terrainHeight(x, z) + size * .24, z, size * (1 + random() * .4), size * (.4 + random() * .45), size, random() * 6.28, 1.4);
  }
  // Small loose chips form overlapping debris fans, with a quieter valley floor.
  for (let i = 0; i < 4600; i++) {
    const fan = fans[i % fans.length];
    const z = i % 6 ? fan.z + (random() - .5) * fan.spread * 3 : 190 - random() * 1120;
    const x = i % 6 ? fan.x - fan.side * random() * fan.spread * 1.7 : canyonCenter(z) + (random() - .5) * canyonWidth(z) * 1.5;
    const size = .10 + Math.pow(random(), 3) * .9;
    rock(16 + i % 4, x, terrainHeight(x, z) + size * .18, z, size * (1 + random()), size * .5, size, random() * 6.28, 2);
  }
  const mineralTints = [new Color().setRGB(.82, .86, .88), new Color().setRGB(1.08, .89, .75), new Color().setRGB(1.19, 1.14, 1.06)];
  for (let i = 0; i < variants.length; i++) {
    const mesh = new InstancedMesh(variants[i], i >= 24 ? materials.distantRock : materials.rock, transforms[i].length);
    mesh.name = variants[i].name; mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;
    const tint = new Color();
    transforms[i].forEach((matrix, j) => {
      mesh.setMatrixAt(j, matrix);
      const x = matrix.elements[12], z = matrix.elements[14];
      // Neighboring masses share a mineral deposit; small local differences
      // keep loose stones distinct without assigning unrelated rainbow hues.
      const region = noise(x * .008, z * .008, 37) * .5 + .5;
      const local = noise(x * .045, z * .045, 83) * .5 + .5;
      const mineral = smoothstep(.22, .78, region * .6 + local * .25 + random() * .15);
      tint.copy(mineralTints[0]).lerp(mineralTints[1], smoothstep(.05, .55, mineral))
        .lerp(mineralTints[2], smoothstep(.5, .95, mineral)).multiplyScalar(.88 + random() * .24);
      mesh.setColorAt(j, tint);
    });
    group.add(mesh); batches.push(mesh);
  }
  // Heat compresses the reflected view to a few dozen pixels vertically.
  // Matching low-detail rocks keep the extra camera's queues and memory small.
  const reflectionGroup = new BundleGroup(), reflectionMeshes = [];
  reflectionGroup.name = 'Distant rock silhouettes for the mirage'; reflectionGroup.layers.set(1);
  const reflectedBedrock = new Mesh(createIslandBedrock(variants[0].userData.beds, 16), materials.distantRock);
  reflectedBedrock.name = 'Sanctuary bedrock reflection';
  reflectedBedrock.position.copy(bedrock.position); reflectedBedrock.scale.copy(bedrock.scale); reflectedBedrock.layers.set(1);
  reflectedBedrock.receiveShadow = true; reflectedBedrock.frustumCulled = false; reflectionGroup.add(reflectedBedrock);
  for (let i = 0; i < variants.length; i++) {
    const selected = transforms[i].map((matrix, index) => ({ matrix, index }))
      .filter(({ matrix: m }) => Math.hypot(m.elements[0], m.elements[1], m.elements[2]) > 2.5);
    if (!selected.length) continue;
    const geometry = createRockGeometry(151 + i * 7919, specs[i][0], i < 8 ? 16 : i < 24 ? 12 : 8);
    const mesh = new InstancedMesh(geometry, materials.distantRock, selected.length);
    const tint = new Color();
    selected.forEach(({ matrix, index }, j) => {
      mesh.setMatrixAt(j, matrix); batches[i].getColorAt(index, tint); mesh.setColorAt(j, tint);
    }); mesh.layers.set(1);
    mesh.name = `Mirage rock silhouette / ${i}`; mesh.receiveShadow = true; mesh.frustumCulled = false;
    reflectionMeshes.push(mesh); reflectionGroup.add(mesh);
  }
  scene.add(reflectionGroup);
  reportProgress(.5, 'Sculpting the dunes…'); await new Promise(requestAnimationFrame);
  lastYield = performance.now();
  const terrain = new PlaneGeometry(1700, 1900, 420, 470); terrain.rotateX(-Math.PI / 2); terrain.translate(0, 0, -520);
  const p = terrain.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, terrainHeight(p.getX(i), p.getZ(i)));
  terrain.computeVertexNormals(); terrain.computeBoundingSphere();
  terrain.userData.preserveSurface = true;
  const ground = new Mesh(terrain, materials.sand); ground.name = 'Continuous dune field'; ground.receiveShadow = true;
  group.add(ground); scene.add(group);
  // Coarse rectangular rings extend the terrain 200 km in every direction. Only the nearby
  // terrain needs dense tessellation; the distant rings disappear into air.
  const distanceTerrain = [];
  let innerX = 850, innerZ = 950;
  for (const outer of [1700, 3200, 6000, 11000, 19000, 31000, 50000, 80000, 125000, 200000]) {
    reportProgress(.55 + distanceTerrain.length * .04, 'Extending the horizon…');
    if (performance.now() - lastYield > 12) {
      await new Promise(requestAnimationFrame);
      lastYield = performance.now();
    }
    // Concentrate vertices in the northern ranges. Uniform resolution spent
    // most of the memory on empty plains while leaving distant crests faceted.
    // All four sides retain identical radial rows to meet without corner gaps.
    const rows = outer === 1700 ? 20 : outer === 3200 ? 32 : outer <= 50000 ? 112 : 96;
    const columns = outer === 1700 ? [128, 128, 128, 128] : outer === 3200 ? [256, 256, 256, 256]
      : outer === 11000 || outer === 19000 ? [512, 128, 64, 128] : outer > 19000 ? [512, 64, 32, 64] : [512, 96, 64, 96];
    const vertices = [], indices = [], sides = [];
    for (let side = 0; side < 4; side++) {
      const start = vertices.length / 3, segments = columns[side];
      sides.push({ start, segments });
      for (let row = 0; row <= rows; row++) for (let col = 0; col <= segments; col++) {
        const t = row / rows, u = col / segments * 2 - 1;
        const rx = innerX + (outer - innerX) * t, rz = innerZ + (outer + 100 - innerZ) * t;
        const x = side === 0 ? u * rx : side === 1 ? rx : side === 2 ? -u * rx : -rx;
        const z = (side === 0 ? -rz : side === 1 ? u * rz : side === 2 ? rz : -u * rz) - 520;
        const height = terrainHeight(x, z);
        vertices.push(x, height, z);
      }
      for (let row = 1; row < rows; row++) for (let col = 0; col < segments; col++) {
        const a = start + row * (segments + 1) + col, b = a + segments + 1;
        indices.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
    // Use the preceding mesh's exact boundary vertices, then zipper them
    // to this ring's first full row. Interpolation alone left T-junctions
    // wherever the coarser edge skipped a peak on the finer edge.
    const stitches = [];
    const previous = distanceTerrain.at(-1);
    for (let side = 0; side < 4; side++) {
      const segments = columns[side];
      const count = previous ? previous.userData.grid.sides[side].segments : side % 2 ? 470 : 420;
      const inner = [], outerRow = [];
      for (let col = 0; col <= count; col++) {
        const g = previous?.userData.grid, pp = previous ? previous.geometry.attributes.position : p;
        const index = previous ? g.sides[side].start + g.rows * (count + 1) + col
          : side === 0 ? col : side === 1 ? col * 421 + 420 : side === 2 ? 470 * 421 + 420 - col : (470 - col) * 421;
        inner.push(vertices.length / 3);
        vertices.push(pp.getX(index), pp.getY(index), pp.getZ(index));
      }
      const start = sides[side].start + segments + 1;
      for (let col = 0; col <= segments; col++) outerRow.push(start + col);
      const stitch = stitchTerrainEdge(inner, outerRow);
      indices.push(...stitch.triangles); stitches.push(stitch.bins);
    }
    const geometry = new BufferGeometry();
    const positionAttribute = new Float32BufferAttribute(vertices, 3);
    const normalAttribute = new Float32BufferAttribute(vertices.length, 3);
    const positions = positionAttribute.array, normals = normalAttribute.array;
    geometry.setAttribute('position', positionAttribute);
    geometry.setAttribute('normal', normalAttribute);
    geometry.setIndex(indices);
    for (let i = 0; i < indices.length; i += 3) {
      const a = indices[i] * 3, b = indices[i + 1] * 3, c = indices[i + 2] * 3;
      if (positions[a + 2] <= -1800 && positions[b + 2] <= -1800 && positions[c + 2] <= -1800) continue;
      const cbx = positions[c] - positions[b], cby = positions[c + 1] - positions[b + 1], cbz = positions[c + 2] - positions[b + 2];
      const abx = positions[a] - positions[b], aby = positions[a + 1] - positions[b + 1], abz = positions[a + 2] - positions[b + 2];
      const nx = cby * abz - cbz * aby, ny = cbz * abx - cbx * abz, nz = cbx * aby - cby * abx;
      normals[a] += nx; normals[a + 1] += ny; normals[a + 2] += nz;
      normals[b] += nx; normals[b + 1] += ny; normals[b + 2] += nz;
      normals[c] += nx; normals[c + 1] += ny; normals[c + 2] += nz;
    }
    // Sample the heightfield's slope directly. Averaging the normals of long
    // ring triangles stamped a repeating sawtooth pattern along every ridge.
    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i], z = positions[i + 2];
      if (z > -1800) {
        const nx = normals[i], ny = normals[i + 1], nz = normals[i + 2];
        const length = Math.sqrt(nx * nx + ny * ny + nz * nz);
        if (length === 0 || ny === 0) { normals[i] = 0; normals[i + 1] = 1; normals[i + 2] = 0; }
        else { normals[i] = nx / length; normals[i + 1] = ny / length; normals[i + 2] = nz / length; }
        continue;
      }
      const step = 8, twoStep = step * 2; // Identical gradients on both sides of a stitched boundary.
      const dx = terrainHeight(x - step, z) - terrainHeight(x + step, z);
      const dz = terrainHeight(x, z - step) - terrainHeight(x, z + step);
      const length = Math.sqrt(dx * dx + twoStep * twoStep + dz * dz);
      normals[i] = dx / length; normals[i + 1] = twoStep / length; normals[i + 2] = dz / length;
    }
    geometry.userData.preserveSurface = true;
    const mesh = new Mesh(geometry, materials.sand); mesh.name = `Distant terrain / ${outer} m`; group.add(mesh); distanceTerrain.push(mesh);
    mesh.userData.grid = { innerX, innerZ, outerX: outer, outerZ: outer + 100, sides, rows, stitches };
    innerX = outer; innerZ = outer + 100;
  }
  group.needsUpdate = true;
  // Sample the actual tessellated surface for wheel contact. The analytic
  // terrain alone can differ from a coarse distant triangle by many metres.
  function triangleHeight(attribute, a, b, c, x, z) {
    const ax = attribute.getX(a), az = attribute.getZ(a), bx = attribute.getX(b), bz = attribute.getZ(b), cx = attribute.getX(c), cz = attribute.getZ(c);
    const det = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
    const u = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / det;
    const v = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / det;
    return { inside: u >= -1e-6 && v >= -1e-6 && u + v <= 1.000001, height: u * attribute.getY(a) + v * attribute.getY(b) + (1 - u - v) * attribute.getY(c) };
  }
  function cellHeight(attribute, a, stride, x, z) {
    const first = triangleHeight(attribute, a, a + 1, a + stride, x, z);
    return first.inside ? first.height : triangleHeight(attribute, a + 1, a + stride + 1, a + stride, x, z).height;
  }
  function heightAt(x, z) {
    if (Math.abs(x) <= 850 && z >= -1470 && z <= 430) {
      const col = Math.min(419, Math.max(0, Math.floor((x + 850) / 1700 * 420)));
      const row = Math.min(469, Math.max(0, Math.floor((z + 1470) / 1900 * 470)));
      return cellHeight(p, row * 421 + col, 421, x, z);
    }
    const zz = z + 520;
    for (const mesh of distanceTerrain) {
      const g = mesh.userData.grid;
      if (Math.abs(x) > g.outerX || Math.abs(zz) > g.outerZ) continue;
      for (let side = 0; side < 4; side++) {
        const t = side === 0 ? (-zz - g.innerZ) / (g.outerZ - g.innerZ) : side === 2 ? (zz - g.innerZ) / (g.outerZ - g.innerZ) : ((side === 1 ? x : -x) - g.innerX) / (g.outerX - g.innerX);
        if (t < 0 || t > 1) continue;
        const rx = g.innerX + (g.outerX - g.innerX) * t, rz = g.innerZ + (g.outerZ - g.innerZ) * t;
        const u = side === 0 ? x / rx : side === 1 ? zz / rz : side === 2 ? -x / rx : -zz / rz;
        if (Math.abs(u) > 1.000001) continue;
        const { start, segments } = g.sides[side];
        const row = Math.min(g.rows - 1, Math.floor(t * g.rows)), col = Math.min(segments - 1, Math.max(0, Math.floor((u + 1) * .5 * segments)));
        if (row === 0) {
          for (const [a, b, c] of g.stitches[side][col]) {
            const hit = triangleHeight(mesh.geometry.attributes.position, a, b, c, x, z);
            if (hit.inside) return hit.height;
          }
        }
        return cellHeight(mesh.geometry.attributes.position, start + row * (segments + 1) + col, segments + 1, x, z);
      }
    }
    return terrainHeight(x, z);
  }
  reportProgress(.95, 'Scattering desert details…'); await new Promise(requestAnimationFrame);
  const grass = createDesertGrass(group, heightAt); group.needsUpdate = true;
  reportProgress(1, 'The landscape is ready');
  return { group, reflectionGroup, reflectionMeshes, variants, batches, bedrock, ground, distanceTerrain, obstacles, heightAt, grass, detailInstances: grass.instances,
    surfaceAt(x, z) { const rock = islandSurface(x, z); return Number.isFinite(rock) ? Math.max(heightAt(x, z), rock) : heightAt(x, z); },
    instances: transforms.reduce((n, t) => n + t.length, 0) + 1,
    triangles: batches.reduce((n, m) => n + m.count * m.geometry.index.count / 3, 0) + bedrock.geometry.index.count / 3 + terrain.index.count / 3 + distanceTerrain.reduce((n, m) => n + m.geometry.index.count / 3, 0) + grass.triangles,
    dispose() { scene.remove(group, reflectionGroup); grass.dispose(); reflectionMeshes.forEach(m => { m.geometry.dispose(); m.dispose(); }); reflectedBedrock.geometry.dispose(); bedrock.geometry.dispose(); bedrockCollision.dispose(); variants.forEach(g => g.dispose()); collisionGeometry.forEach(g => g?.dispose()); smallCollisionGeometry.forEach(g => g?.dispose()); terrain.dispose(); distanceTerrain.forEach(m => m.geometry.dispose()); batches.forEach(m => m.dispose()); }
  };
}

function rasterizeRockSurface(variants, transforms, cx, cz) {
  const width = 281, depth = 271, x0 = cx - 140, z0 = cz - 160;
  const heights = new Float32Array(width * depth).fill(-Infinity);
  variants.forEach((geometry, variant) => {
    const p = geometry.attributes.position, indices = geometry.index.array;
    for (const matrix of transforms[variant]) {
      const e = matrix.elements, vertices = new Float64Array(p.count * 3);
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = i * 3;
        vertices[k] = e[0] * x + e[4] * y + e[8] * z + e[12] - x0;
        vertices[k + 1] = e[1] * x + e[5] * y + e[9] * z + e[13];
        vertices[k + 2] = e[2] * x + e[6] * y + e[10] * z + e[14] - z0;
      }
      for (let i = 0; i < indices.length; i += 3) {
        const a = indices[i] * 3, b = indices[i + 1] * 3, c = indices[i + 2] * 3;
        const ax = vertices[a], az = vertices[a + 2], bx = vertices[b], bz = vertices[b + 2], ccx = vertices[c], ccz = vertices[c + 2];
        const determinant = (bz - ccz) * (ax - ccx) + (ccx - bx) * (az - ccz);
        if (Math.abs(determinant) < 1e-9) continue;
        const minX = Math.max(0, Math.ceil(Math.min(ax, bx, ccx))), maxX = Math.min(width - 1, Math.floor(Math.max(ax, bx, ccx)));
        const minZ = Math.max(0, Math.ceil(Math.min(az, bz, ccz))), maxZ = Math.min(depth - 1, Math.floor(Math.max(az, bz, ccz)));
        for (let z = minZ; z <= maxZ; z++) for (let x = minX; x <= maxX; x++) {
          const u = ((bz - ccz) * (x - ccx) + (ccx - bx) * (z - ccz)) / determinant;
          const v = ((ccz - az) * (x - ccx) + (ax - ccx) * (z - ccz)) / determinant;
          if (u < 0 || v < 0 || u + v > 1) continue;
          const y = u * vertices[a + 1] + v * vertices[b + 1] + (1 - u - v) * vertices[c + 1];
          heights[z * width + x] = Math.max(heights[z * width + x], y);
        }
      }
    }
  });
  return (x, z) => {
    const xx = x - x0, zz = z - z0, i = Math.floor(xx), j = Math.floor(zz);
    if (i < 0 || i >= width - 1 || j < 0 || j >= depth - 1) return -Infinity;
    const k = j * width + i, u = xx - i, v = zz - j;
    return (heights[k] * (1 - u) + heights[k + 1] * u) * (1 - v) + (heights[k + width] * (1 - u) + heights[k + width + 1] * u) * v;
  };
}
