import { BundleGroup, InstancedMesh, Object3D, CylinderGeometry, SphereGeometry, BoxGeometry, TorusGeometry, Shape, ExtrudeGeometry, Color, Mesh, MeshStandardNodeMaterial, PointLight, Float32BufferAttribute, Vector3 } from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { createMasonryGeometry } from './rock-geometry.js';
import { cathedral } from './world-layout.js';
import { randomSeed, terrainHeight, noise } from './noise.js';
import { addSceneDetails } from './scene-details.js';
import { createSanctuaryProjection } from './sanctuary-light.js';
import { createStairLod } from './stair-lod.js';

// Reusable carved stones: the detail is real relief geometry, shared by the
// facade instances and reduced by the same meshlet pipeline as the cliffs.
function carvingTile(rosette = false) {
  const parts = [];
  const bar = (x, y, w, h, angle = 0) => {
    const g = new BoxGeometry(w, h, .12); g.rotateZ(angle); g.translate(x, y, .04); parts.push(g);
  };
  if (rosette) {
    parts.push(new TorusGeometry(.34, .045, 5, 32));
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2;
      const petal = new SphereGeometry(1, 8, 6);
      petal.scale(.14, .055, .045); petal.rotateZ(a);
      petal.translate(Math.cos(a) * .18, Math.sin(a) * .18, .045); parts.push(petal);
    }
    const boss = new SphereGeometry(.10, 12, 8); boss.scale(1, 1, .6); parts.push(boss);
  } else {
    bar(0, -.43, .94, .10); bar(-.42, 0, .10, .94);
    bar(-.04, .42, .84, .10); bar(.34, .09, .10, .65);
    bar(.04, -.18, .65, .10); bar(-.22, .02, .10, .46);
    bar(.01, .20, .45, .10); bar(.19, .10, .10, .27);
  }
  const geometry = mergeGeometries(parts); parts.forEach(g => g.dispose()); geometry.clearGroups(); return geometry;
}

function spandrelGeometry(portal) {
  const parts = [], radius = portal.inner + 3.8;
  for (let y0 = portal.spring; y0 < portal.spring + portal.outer; y0 += 2.15) for (let x0 = -portal.outer; x0 < portal.outer; x0 += 3.2) {
    const x1 = Math.min(portal.outer, x0 + 3.2), y1 = Math.min(portal.spring + portal.outer, y0 + 2.15);
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2 - portal.spring, length = Math.hypot(cx, cy);
    const nx = cx / length, ny = cy / length;
    const corners = [[x0 + .025, y0 + .025], [x1 - .025, y0 + .025], [x1 - .025, y1 - .025], [x0 + .025, y1 - .025]], polygon = [];
    // Clip each course to the tangent outside the archivolt. This leaves
    // fitted wedge-shaped stones rather than rectangular blocks over the arch.
    for (let i = 0; i < 4; i++) {
      const a = corners[i], b = corners[(i + 1) % 4];
      const fa = a[0] * nx + (a[1] - portal.spring) * ny - radius;
      const fb = b[0] * nx + (b[1] - portal.spring) * ny - radius;
      if (fa >= 0) polygon.push(a);
      if ((fa < 0) !== (fb < 0)) { const t = fa / (fa - fb); polygon.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
    }
    if (polygon.length < 3) continue;
    const shape = new Shape(); shape.moveTo(...polygon[0]); for (const point of polygon.slice(1)) shape.lineTo(...point); shape.closePath();
    const stone = new ExtrudeGeometry(shape, { depth: .8, bevelEnabled: true, bevelThickness: .025, bevelSize: .025, bevelSegments: 1, curveSegments: 1 });
    stone.translate(0, 0, 27.1); parts.push(stone);
  }
  const geometry = mergeGeometries(parts); parts.forEach(g => g.dispose()); geometry.clearGroups(); return geometry;
}

export function createArchitecture(scene, materials, surfaceAt = terrainHeight) {
  const random = randomSeed(1579), group = new BundleGroup(), dummy = new Object3D();
  group.name = 'Rock-carved cathedral of the mirage';
  const geometries = [createMasonryGeometry(13), createMasonryGeometry(37), createMasonryGeometry(71)];
  const column = new CylinderGeometry(.5, .59, 1, 24, 8), cp = column.attributes.position;
  for (let i = 0; i < cp.count; i++) {
    const x = cp.getX(i), z = cp.getZ(i), a = Math.atan2(z, x), f = 1 + Math.cos(a * 12) * .065;
    cp.setXYZ(i, x * f, cp.getY(i), z * f);
  }
  column.computeVertexNormals(); geometries.push(column);
  const dome = new SphereGeometry(1, 32, 16, 0, Math.PI * 2, 0, Math.PI * .5); geometries.push(dome);
  geometries.push(new CylinderGeometry(0, 1, 1, 8, 2));
  geometries.push(new BoxGeometry(1, 1, 1), new BoxGeometry(1, 1, 1), carvingTile(), carvingTile(true));
  const portal = { spring: 25, inner: 15.5, outer: 21.3 };
  const vaultSection = new Shape();
  // Fill the spandrels up to the lintel as well as the arch itself. A bare
  // ring leaves triangular voids between the curved crown and the gallery.
  vaultSection.moveTo(-portal.outer, 0);
  vaultSection.lineTo(-portal.outer, portal.spring + portal.outer);
  vaultSection.lineTo(portal.outer, portal.spring + portal.outer);
  vaultSection.lineTo(portal.outer, 0); vaultSection.lineTo(portal.inner, 0);
  vaultSection.lineTo(portal.inner, portal.spring);
  vaultSection.absarc(0, portal.spring, portal.inner, 0, Math.PI, false);
  vaultSection.lineTo(-portal.inner, 0); vaultSection.closePath();
  const vault = new ExtrudeGeometry(vaultSection, { depth: 27, bevelEnabled: false, curveSegments: 48 });
  vault.clearGroups(); geometries.push(vault);
  // Simplifying these thin, closely spaced courses blends front/back normals
  // and produces flickering black patches. Keep this small trim mesh intact.
  const spandrels = spandrelGeometry(portal); spandrels.userData.preserveSurface = true;
  geometries.push(spandrels);
  // Weathered unit blocks distort when stretched into tall stair supports:
  // their uneven tops can penetrate the thin tread above. Keep the supports
  // planar and round the exposed tread edge by 6 cm in masonry units.
  const stairBody = geometries.length, support = new BoxGeometry(1, 1, 1);
  support.clearGroups(); support.userData.preserveSurface = true; geometries.push(support);
  const stairTread = geometries.length, tread = new RoundedBoxGeometry(22, .18, .76, 3, .06);
  tread.scale(1 / 22, 1 / .18, 1 / .76); tread.clearGroups();
  tread.userData.preserveSurface = true; geometries.push(tread);
  const records = geometries.map(() => []), finishes = geometries.map(() => []), batches = [], colliders = [];
  let sanctuary = true;
  const origin = [cathedral.x, cathedral.y, cathedral.z];
  function piece(g, x, y, z, w, h, d, ry = 0, rz = 0, rx = 0, finish = null) {
    const monumentalScale = 1.18;
    dummy.position.set(origin[0] + x * monumentalScale, origin[1] + y * monumentalScale, origin[2] + z * monumentalScale);
    dummy.scale.set(w * monumentalScale, h * monumentalScale, d * monumentalScale); dummy.rotation.set(rx, ry, rz); dummy.updateMatrix();
    // Use the same scale on all axes: the previous extra vertical stretch
    // made the sanctuary too tall relative to its terrace and staircase.
    (records[g] ||= []).push(dummy.matrix.clone());
    (finishes[g] ||= []).push(finish ?? (sanctuary && (g === 3 || g === 7) ? 'marble' : sanctuary && (g === 4 || g === 5 || g === 9) ? 'gold' : 'stone'));
    if (g <= 3 || g === 6 || g === stairBody || g === stairTread) {
      const e = dummy.matrix.elements;
      colliders.push({ x: e[12], y: e[13], z: e[14], rx: (Math.abs(e[0]) + Math.abs(e[4]) + Math.abs(e[8])) / 2,
        ry: (Math.abs(e[1]) + Math.abs(e[5]) + Math.abs(e[9])) / 2, rz: (Math.abs(e[2]) + Math.abs(e[6]) + Math.abs(e[10])) / 2, matrix: [...e] });
    }
  }
  function block(x, y, z, w, h, d, damaged = false, finish = null) { piece(Math.floor(random() * 3), x, y, z, w, h, d, 0, damaged ? (random() - .5) * .028 : 0, 0, finish); }
  function wall(x, y, z, w, h, d, rows = Math.ceil(h / 2.1)) {
    const cols = Math.max(1, Math.round(w / 3.2));
    for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
      const bw = w / cols;
      block(x - w / 2 + (col + .5) * bw, y + (row + .5) * h / rows, z, bw - .035, h / rows - .025, d, true);
    }
  }
  function frieze(x, y, z, width, motif = 8, size = 1.5) {
    const count = Math.floor(width / size);
    for (let i = 0; i < count; i++) piece(motif, x - (count - 1) * size * .5 + i * size, y, z, size * .86, size * .86, size);
  }
  function trim(x, y, z, width, height, motif = 8) {
    const pitch = 1.35;
    for (const side of [-1, 1]) {
      block(x + side * width / 2, y + height / 2, z, 1.5, height + 1.4, .8);
      for (let i = 0; i < height / pitch; i++) piece(motif, x + side * width / 2, y + .5 + i * pitch, z + .5, 1.15, 1.15, 1.4);
    }
    block(x, y + height + .4, z, width + 1.5, 1.3, 1.2);
    frieze(x, y + height + .45, z + .7, width, motif, 1.35);
    block(x, y - .3, z, width + 2.3, .9, 2.2);
  }
  function cornice(x, y, z, w, d, ornate = true) {
    block(x, y, z, w, 1.1, d);
    block(x, y + .8, z, w + 1.6, .65, d + 1.6, false, 'gold');
    block(x, y + 1.4, z, w + 2.8, .65, d + 2.8);
    for (let i = 0; i < w / 1.3; i++) for (const side of [-1, 1]) block(x - w / 2 + .55 + i * 1.3, y - .8, z + side * d * .49, .65, .9, 1.2);
    if (ornate) for (const side of [-1, 1]) frieze(x, y + .2, z + side * (d * .5 + .1), w - 1, 9, 1.3);
  }
  function pillar(x, y, z, h, radius = .7) {
    block(x, y + .5, z, radius * 2.7, 1, radius * 2.7, false, sanctuary ? 'orangeMarble' : null);
    piece(3, x, y + h * .5, z, radius * 1.7, h - 1.5, radius * 1.7);
    for (const yy of [1.2, h * .32, h * .75, h - 1]) block(x, y + yy, z, radius * 2, .3, radius * 2, false, 'gold');
    block(x, y + h - .5, z, radius * 2.7, 1, radius * 2.7);
    piece(9, x, y + h - .45, z + radius * 1.4, radius * 1.3, radius * 1.3, radius);
  }
  function shrine(x, y, z, w, h) {
    for (let i = 0; i < 3; i++) block(x, y + i * .55, z, w + 2.4 - i * .6, .7, w + 2.4 - i * .6, false, sanctuary && i === 1 ? 'orangeMarble' : null);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) pillar(x + sx * w * .34, y + 1.5, z + sz * w * .34, h, w * .065);
    cornice(x, y + h + 1.4, z, w, w, false);
    for (let i = 0; i < 4; i++) block(x, y + h + 3.5 + i * .75, z, w * (1 - i * .18), .85, w * (1 - i * .18));
    piece(4, x, y + h + 6, z, w * .22, w * .16, w * .22);
    piece(5, x, y + h + 7.8, z, .5, 3, .5);
  }
  function panel(x, y, z, w, h, blue = false) {
    if (blue) piece(6, x, y + h * .5, z - .5, w, h, .6, 0, 0, 0, sanctuary ? 'orangeMarble' : null);
    else block(x, y + h * .5, z - .5, w, h, .6, false, sanctuary ? 'orangeMarble' : null);
    if (blue) {
      piece(7, x, y + h * .5, z - .12, w * .7, h * .87, .24);
      // Gold relief is set into the green marble panel.
      for (let row = 0; row < h / 2; row++) for (let col = 0; col < 2; col++) {
        if (random() < .2) continue;
        piece(8, x + (col - .5) * w * .3, y + 1 + row * 2, z + .12, w * .28, 1.65, 2, 0, 0, 0, 'gold');
      }
    } else {
      const cols = Math.max(1, Math.floor(w / 2.7));
      for (let row = 0; row < h / 2.7; row++) for (let col = 0; col < cols; col++) piece(9, x + (col - (cols - 1) / 2) * 2.6, y + 1.25 + row * 2.7, z + .05, 2.1, 2.1, 1.8);
    }
    trim(x, y, z + .35, w + 1.6, h, 8);
  }
  function tower(x, z, w, depth, height) {
    // Thick piers enclose recessed facade bays. The upper pavilion is open.
    const stages = [0, height * .34, height * .69], front = z + depth / 2;
    for (let stage = 0; stage < 3; stage++) {
      const y = stages[stage], h = stage === 2 ? height * .24 : height * .30;
      wall(x, y, z - 2, w - 3, h, depth - 7);
      for (const side of [-1, 1]) wall(x + side * (w / 2 - 2), y, front - 2, 4, h, 6);
      panel(x, y + 2, front - 1.6, w * .38, h - 4, stage !== 1);
      for (const side of [-1, 1]) {
        pillar(x + side * (w * .40), y, front + .4, h, .9);
        trim(x + side * w * .27, y + 1, front + .15, 1.6, h - 2, 9);
      }
      cornice(x, y + h + .5, z, w + .8, depth + 1.5);
      if (stage < 2) {
        const gap = stages[stage + 1] - y - h;
        wall(x, y + h + 2.4, z, w - 1, Math.max(1, gap - 2.4), depth - 1, 2);
        frieze(x, y + h + 3.2, front + .8, w - 1, 9, 2.1);
      }
    }
    const top = height * .93 + 2;
    shrine(x, top, z, w * .68, 8.5);
    // Stepped corner crowns, with a few missing stones along the skyline.
    for (const side of [-1, 1]) {
      block(x + side * (w * .47), top + 1, front, 2.1, 3.5, 2.1);
      piece(5, x + side * w * .47, top + 3.6, front, 1.2, 2.5, 1.2);
    }
    // Carved side pilasters are readable as the camera orbits around the island.
    for (const side of [-1, 1]) for (let bay = 0; bay < 4; bay++) {
      const zz = z - depth * .37 + bay * depth * .25;
      block(x + side * w * .5, height * .46, zz, 1.5, height * .9, 1.4);
      for (let row = 0; row < 15; row++) piece(9, x + side * (w * .5 + .8), 3 + row * height * .055, zz, 2.4, 2.5, 1.6, side * Math.PI / 2);
    }
  }

  // Broad foundations continue the island's natural bedding. The sanctuary
  // has massive, stepped volumes rather than a roof-and-spire silhouette.
  for (let i = 0; i < 7; i++) block(0, -5 + i * .7, -2, 86 - i * 1.4, .9, 97 - i * 1.4);
  wall(0, -12, -2, 84, 7, 94, 4);
  tower(-34, 12, 27, 31, 78);
  tower(34, 6, 25, 32, 82);
  tower(-62, -13, 23, 30, 42);
  tower(63, -23, 22, 33, 51);
  // Receding wings, roof galleries and lower gates make the sanctuary a
  // connected complex embedded in the island, with a clear central hierarchy.
  for (const side of [-1, 1]) {
    wall(side * 46, -3, -13, 17, 25, 32, 12);
    panel(side * 46, 2, 3.8, 7, 16, false);
    cornice(side * 46, 23, -13, 21, 35);
    for (let i = 0; i < 5; i++) pillar(side * 46 - 8 + i * 4, 25, 4.5, 8, .55);
    cornice(side * 46, 33.5, -13, 21, 35);
    for (let i = 0; i < 7; i++) block(side * 80, 2, -42 + i * 7, 2.2, 6, 2.5);
    block(side * 80, 5.4, -21, 3, .8, 47);
  }
  // A deep processional entrance sits under a round, carved archivolt.
  for (const side of [-1, 1]) {
    wall(side * 20.7, 0, 16, 6.4, 45, 16);
    for (let j = 0; j < 3; j++) pillar(side * (16.4 + j * .9), 0, 26 + j * .6, portal.spring + 2, .55);
    trim(side * 20.7, .6, 28.3, 2.1, 43, 8);
  }
  piece(6, 0, 24, -2, 39, 48, 2);
  // The decorated archivolt sits on a continuous barrel vault. Its real
  // intrados hides the rectangular rear wall at every oblique viewpoint.
  piece(10, 0, 0, 0, 1, 1, 1);
  piece(11, 0, 0, 0, 1, 1, 1);
  for (const side of [-1, 1]) wall(side * (portal.inner + 2.9), 0, 12, 5.8, portal.spring, 24);
  for (let layer = 0; layer < 3; layer++) for (let i = 0; i < 32; i++) {
    const a = (i + .5) / 32 * Math.PI, r = portal.inner + .6 + layer * 1.2;
    piece(i % 3, Math.cos(a) * r, portal.spring + Math.sin(a) * r, 27 + layer * .4, Math.PI * r / 32 * .98, 1.15, 3, 0, a + Math.PI / 2, 0, layer === 0 ? 'orangeMarble' : layer === 1 ? 'marble' : 'stone');
    if (layer === 2) piece(9, Math.cos(a) * r, portal.spring + Math.sin(a) * r, 28.9, 1.1, 1.1, 1.7, 0, a);
  }
  // Individual courses line the vault, giving the broad entrance readable
  // depth and joints instead of an uninterrupted, mottled curved surface.
  for (let row = 0; row < 6; row++) for (let i = 0; i < 24; i++) {
    const a = (i + .5) / 24 * Math.PI, r = portal.inner + .24;
    piece((i + row) % 3, Math.cos(a) * r, portal.spring + Math.sin(a) * r, 2.25 + row * 4.5, Math.PI * r / 24 * .98, .6, 4.45, 0, a + Math.PI / 2);
  }
  wall(0, 45, 17, 43, 7, 18, 4);
  frieze(0, 49, 26.4, 42, 9, 2.6);
  cornice(0, 53, 16, 46, 24);
  // An open gallery spans the portal; its shadows read from across the basin.
  wall(0, 56, 4, 43, 10, 3, 5);
  for (let i = -4; i <= 4; i++) pillar(i * 4.6, 56, 25, 10.5, .65);
  cornice(0, 67, 15, 47, 27);
  block(0, 69.9, 27.6, 45, 2, 3);
  frieze(0, 70, 29.3, 45, 8, 1.8);
  block(0, 2.5, 23, 2.2, 5, 2.2, false, 'orangeMarble');
  // The upper sanctum steps forward onto the gallery's rear wall. Keeping
  // its height while bringing the tiers forward restores the stepped crown
  // in the silhouette without stretching the entire building vertically.
  wall(0, 0, -25, 43, 61, 38, 26);
  const upperZ = -2;
  for (let level = 0; level < 3; level++) {
    const y = 61 + level * 12, w = 42 - level * 7, d = 35 - level * 5;
    cornice(0, y, upperZ, w + 1, d + 1);
    wall(0, y + 2, upperZ - 3, w - 4, 9, d - 8, 4);
    for (let i = -2; i <= 2; i++) pillar(i * (w - 5) / 5, y + 2, upperZ + d / 2, 9, .6);
    panel(0, y + 3, upperZ + d / 2 - 1, 6, 6, true);
  }
  shrine(0, 96, upperZ, 17, 10);
  // Small towers and balustrades establish human scale at the terraces.
  for (const side of [-1, 1]) {
    shrine(side * 39, -1, 36, 7, 6);
    for (let i = 0; i < 15; i++) block(side * 40, 2, -41 + i * 5, 1.1, 3, 1.3);
    block(side * 40, 3.6, -6, 1.6, .65, 74);
  }
  // Continuous flights and landings climb from sand to the entrance. Solid
  // stepped foundations carry the treads down to the island and basin floor.
  const stairScale = 1.18, stairStart = 149;
  const floor = (terrainHeight(origin[0], origin[2] + stairStart * stairScale) - origin[1]) / stairScale;
  const stairs = [], flights = [], ramps = [];
  let stairY = floor, stairZ = stairStart;
  // Meet the upper foundation at its actual walking height. Ending a metre
  // lower left a lip that hid the tires and caught the rover at the summit.
  const count = 120, rise = (-.35 - floor) / count;
  function stairPost(x, y, z, grounded = false) {
    if (grounded) {
      // Entrance posts sit beside the first riser, above the basin floor.
      // Carry the full plinth footprint into the lowest terrain sample;
      // the narrow stair sidewall alone leaves its front corners suspended.
      let ground = Infinity;
      for (const dx of [-1.35, 0, 1.35]) for (const dz of [-1.35, 0, 1.35]) {
        ground = Math.min(ground, (surfaceAt(origin[0] + (x + dx) * stairScale, origin[2] + (z + dz) * stairScale) - origin[1]) / stairScale);
      }
      const bottom = Math.min(ground - .18, y - .18), top = y + .14;
      piece(stairBody, x, (bottom + top) / 2, z, 2.7, top - bottom, 2.7);
    }
    block(x, y + .18, z, 2.7, .36, 2.7);
    block(x, y + 1.25, z, 2.05, 2.2, 2.05);
    block(x, y + 2.42, z, 2.55, .4, 2.55, false, 'orangeMarble');
  }
  let flightStart;
  for (let step = 0; step < count; step++) {
    if (step > 0 && step % 20 === 0) {
      piece(stairBody, 0, stairY - .35, stairZ - 1.65, 23, .7, 4.1);
      for (const side of [-1, 1]) {
        wall(side * 11.7, floor - .5, stairZ - 1.65, 1.8, stairY - floor + .8, 4, Math.ceil((stairY - floor + 1) / 2));
        block(side * 11.7, stairY + .85, stairZ - 1.65, 1.45, 1.5, 4.2);
        block(side * 11.7, stairY + 1.75, stairZ - 1.65, 2, .35, 4.2, false, 'orangeMarble');
        stairPost(side * 11.7, stairY, stairZ - 1.65);
      }
      stairZ -= 4;
    }
    stairY += rise;
    if (step % 20 === 0) flightStart = { y: stairY - rise * .5, z: stairZ + .35 };
    const bottom = floor - .7, height = stairY - bottom;
    piece(stairBody, 0, bottom + height / 2, stairZ, 22, height, .76, 0, 0, 0, 'stairNear');
    // Bury the lower half in its support, with no thin projecting underside
    // to form a second high-contrast stripe below every distant step.
    piece(stairTread, 0, stairY, stairZ, 22, .18, .76, 0, 0, 0, 'stairNear');
    for (const side of [-1, 1]) {
      block(side * 11.7, bottom + height / 2, stairZ, 1.5, height + .25, .76);
      if (step === 0 || step === count - 1) stairPost(side * 11.7, stairY, stairZ, step === 0);
    }
    if (step % 20 === 19) {
      const endY = stairY + rise * .5, endZ = stairZ - .35;
      const midZ = (flightStart.z + endZ) / 2, depth = flightStart.z - endZ;
      const ramp = new BoxGeometry(22, 1, depth), positions = ramp.attributes.position;
      for (let i = 0; i < positions.count; i++) {
        const z = positions.getZ(i), t = .5 - z / depth;
        const y = positions.getY(i) > 0 ? flightStart.y + (endY - flightStart.y) * t + .09 : bottom;
        positions.setXYZ(i, positions.getX(i), y, z + midZ);
      }
      ramp.clearGroups(); ramp.computeVertexNormals();
      ramp.setAttribute('stairFlight', new Float32BufferAttribute(new Float32Array(positions.count).fill(flights.length), 1));
      ramps.push(ramp);
      flights.push({ center: new Vector3(origin[0], origin[1] + (flightStart.y + endY) * .5 * stairScale, origin[2] + midZ * stairScale), step: new Vector3(0, rise * stairScale, -.70 * stairScale) });
      const length = Math.hypot(endY - flightStart.y, endZ - flightStart.z), slope = Math.atan2(endY - flightStart.y, flightStart.z - endZ);
      // Long sloping parapets and coping stones follow each flight. Larger
      // newel posts punctuate the landings instead of a picket on every tread.
      for (const side of [-1, 1]) for (let section = 0; section < 5; section++) {
        const t = (section + .5) / 5, y = flightStart.y + (endY - flightStart.y) * t, z = flightStart.z + (endZ - flightStart.z) * t;
        piece(section % 3, side * 11.7, y + .85, z, 1.45, 1.5, length / 5 + .025, 0, 0, slope);
        piece((section + 1) % 3, side * 11.7, y + 1.75, z, 2, .35, length / 5 + .035, 0, 0, slope, 'orangeMarble');
      }
    }
    stairs.push({ x: origin[0], y: origin[1] + stairY * stairScale, z: origin[2] + stairZ * stairScale });
    stairZ -= .70;
  }
  block(0, floor - .10, stairStart + 3, 27, .4, 7);
  block(0, -.75, (stairZ + 36) / 2, 24, .8, stairZ - 36 + 1);
  const distantStairs = mergeGeometries(ramps); ramps.forEach(g => g.dispose());
  distantStairs.userData.preserveSurface = true;
  const stairFar = geometries.length; geometries.push(distantStairs);
  piece(stairFar, 0, 0, 0, 1, 1, 1, 0, 0, 0, 'stairFar');
  const stairLod = createStairLod(materials.masonry, flights);
  // Fallen voussoirs and rubble at the building's foot avoid a pristine base.
  let rubble = 0;
  for (let attempt = 0; attempt < 3400 && rubble < 340; attempt++) {
    const a = random() * Math.PI * 2, r = 42 + random() * 29;
    const x = Math.cos(a) * r, z = Math.sin(a) * r * 1.1;
    if (Math.abs(x) < 14 && z > 25) continue;
    const w = .6 + random() * 2, h = .5 + random(), d = .7 + random() * 1.8, angle = random() * 6.28;
    const heights = [];
    for (const dx of [-w * .5, w * .5]) for (const dz of [-d * .5, d * .5]) {
      const xx = x + Math.cos(angle) * dx + Math.sin(angle) * dz;
      const zz = z - Math.sin(angle) * dx + Math.cos(angle) * dz;
      heights.push(surfaceAt(origin[0] + xx * 1.18, origin[2] + zz * 1.18));
    }
    // A single height at the centre can balance a block on a steep face or
    // leave it hanging over a cliff. Require a shelf under all four corners,
    // then bury the underside slightly for a firm contact with the rock.
    const bottom = Math.min(...heights), top = Math.max(...heights);
    if (!Number.isFinite(bottom + top) || top - bottom > h * .4) continue;
    piece(rubble % 3, x, (bottom - origin[1]) / 1.18 + h * .44, z, w, h, d, angle);
    rubble++;
  }
  const tint = new Color();
  sanctuary = false;
  const details = addSceneDetails(geometries, piece, origin, terrainHeight);
  const bronze = new MeshStandardNodeMaterial({ color: '#776040', metalness: .72, roughness: .6 });
  records.forEach((matrices, i) => {
    const sets = new Map();
    matrices.forEach((matrix, j) => { const finish = finishes[i][j]; if (!sets.has(finish)) sets.set(finish, []); sets.get(finish).push(matrix); });
    for (const [finish, instances] of sets) {
      const material = finish === 'stairNear' ? stairLod.near : finish === 'stairFar' ? stairLod.far : finish === 'marble' ? materials.marble : finish === 'orangeMarble' ? materials.orangeMarble : finish === 'gold' ? materials.gold : details.metalGeometries.includes(i) ? bronze : i === 6 ? materials.dark : i === 7 ? materials.inlay : materials.masonry;
      const mesh = new InstancedMesh(geometries[i], material, instances.length); mesh.name = `Carved sanctuary / ${i} / ${finish}`;
      mesh.castShadow = mesh.receiveShadow = true; mesh.frustumCulled = false;
      // The reflection capture cannot resolve individual small carvings.
      if (i !== 8 && i !== 9) mesh.layers.enable(1);
      instances.forEach((m, j) => {
        mesh.setMatrixAt(j, m);
        const e = m.elements, y = (e[13] - origin[1]) / 1.18;
        // Warm iron-rich courses, honey sandstone and pale carved limestone.
        const course = Math.sin(y * .23 + noise(e[12] * .013, 7, e[14] * .013) * 1.3);
        const iron = Math.max(0, course) * .25, pale = i === 8 || i === 9 || i === 3 ? .09 : 0;
        const k = .80 + random() * .28 + pale;
        tint.setRGB(k * (1 + iron * .15), k * (1 - iron * .48), k * (1 - iron * .80));
        if (finish !== 'stone') tint.setScalar(.92 + (k - .8 - pale) * .25);
        if (finish === 'stairNear' || finish === 'stairFar') tint.setScalar(.94);
        mesh.setColorAt(j, tint);
      });
      batches.push(mesh); group.add(mesh);
    }
  });
  scene.add(group);
  const beaconGeometry = new SphereGeometry(.85, 16, 12);
  const beaconMaterial = new MeshStandardNodeMaterial({ color: '#0b4842', emissive: '#29fff1', emissiveIntensity: 700, roughness: .3 });
  const beacon = new Mesh(beaconGeometry, beaconMaterial); beacon.name = 'Sanctuary signal';
  beacon.position.set(cathedral.x, cathedral.y + 7, cathedral.z + 23 * 1.18); beacon.layers.enable(1); beacon.frustumCulled = false;
  const beaconLight = new PointLight('#3cefd3', 7000, 24, 2); beaconLight.position.copy(beacon.position); beaconLight.layers.enable(1);
  scene.add(beacon, beaconLight);
  const projection = createSanctuaryProjection(scene, beacon);
  return { group, batches, stairs, stairLod, colliders, beacon, beaconLight, projection, details: details.positions, instances: records.reduce((n, a) => n + a.length, 0) + 1, triangles: batches.reduce((n, m) => n + m.count * (m.geometry.index?.count ?? m.geometry.attributes.position.count) / 3, 0) + beaconGeometry.index.count / 3,
    dispose() { projection.dispose(); stairLod.dispose(); scene.remove(group, beacon, beaconLight); beaconGeometry.dispose(); beaconMaterial.dispose(); bronze.dispose(); geometries.forEach(g => g.dispose()); batches.forEach(m => m.dispose()); }
  };
}
