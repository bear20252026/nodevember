import { TorusGeometry, CylinderGeometry } from 'three/webgpu';

// Small ruins share the sanctuary's stones and carvings, so their detail uses
// the existing instanced meshlet batches rather than separate draw objects.
export function addSceneDetails(geometries, piece, origin, heightAt) {
  const ring = geometries.length, point = ring + 1, axis = ring + 2;
  geometries.push(new TorusGeometry(1, .055, 6, 64), new CylinderGeometry(0, .5, 1, 4, 1), new CylinderGeometry(.06, .06, 1, 8));
  geometries[point].rotateY(Math.PI / 4);
  const scale = 1.18;
  const put = (g, x, y, z, w, h, d, ry = 0, rz = 0, rx = 0) => piece(g,
    (x - origin[0]) / scale, (y - origin[1]) / scale, (z - origin[2]) / scale,
    w / scale, h / scale, d / scale, ry, rz, rx);
  function marker(x, z, height, intact = true) {
    const floor = heightAt(x, z) - .12;
    for (let i = 0; i < 3; i++) put(i, x, floor + .2 + i * .4, z, 4.7 - i * .6, .45, 4.7 - i * .6);
    for (let i = 0; i < Math.ceil(height / 3); i++) {
      const h = Math.min(3, height - i * 3), w = 2.6 - i * .11;
      put(i % 3, x, floor + 1.2 + i * 3 + h / 2, z, w, h - .035, w);
      for (const face of [0, 1, 2, 3]) {
        const a = face * Math.PI / 2, y = floor + 1.2 + i * 3 + h / 2, carving = Math.min(1.35, h * .64);
        put(7, x + Math.sin(a) * (w / 2 + .015), y, z + Math.cos(a) * (w / 2 + .015), w * .65, h * .7, .035, a);
        put(i % 2 ? 8 : 9, x + Math.sin(a) * (w / 2 + .07), y, z + Math.cos(a) * (w / 2 + .07), carving, carving, .8, a);
      }
    }
    const topWidth = 2.6 - (Math.ceil(height / 3) - 1) * .11;
    put(0, x, floor + height + 1.35, z, topWidth + .4, .35, topWidth + .4);
    if (intact) put(point, x, floor + height + 2.3, z, topWidth * 1.4, 1.7, topWidth * 1.4);
  }
  marker(-148, -430, 19);
  marker(145, -445, 22);
  marker(-82, -243, 3.2, false);
  marker(113, -318, 5.5, false);
  marker(63, -164, 1.5, false);

  function column(x, z, height, fallen = false) {
    const floor = heightAt(x, z), radius = .9;
    if (fallen) {
      const y = floor + .62;
      for (let i = 0; i < 3; i++) put(3, x + (i - 1) * height / 3, y, z, radius * 1.8, height / 3 - .09, radius * 1.8, 0, Math.PI / 2);
      for (const side of [-1, 1]) {
        put(1, x + side * height * .5, y, z, .52, 2.25, 2.25, 0, .07);
        put(9, x + side * height * .5, y + 1.14, z, 1.5, 1.5, .7, 0, 0, -Math.PI / 2);
      }
    } else {
      for (let i = 0; i < 3; i++) put(i, x, floor + .22 + i * .3, z, 2.8 - i * .3, .35, 2.8 - i * .3);
      put(3, x, floor + 1 + height / 2, z, radius * 1.8, height, radius * 1.8);
      for (const y of [floor + 1.1, floor + height + 1]) {
        put(1, x, y, z, 2.1, .45, 2.1); put(0, x, y + .38, z, 2.6, .35, 2.6);
      }
    }
  }
  column(-102, -287, 9, true);
  column(-165, -340, 14);
  column(-155, -341, 11);
  column(174, -343, 12);
  column(185, -343, 12);
  const lintelY = Math.max(heightAt(174, -343), heightAt(185, -343)) + 14;
  put(0, 179.5, lintelY, -343, 15.5, 1.2, 3.1);
  for (let i = 0; i < 9; i++) put(8, 172.3 + i * 1.8, lintelY, -341.4, 1.3, .9, .75);

  // An oxidized bronze armillary on a low, partly buried stone dais.
  const ax = 78, az = -254, floor = heightAt(ax, az) - .16;
  for (let row = 0; row < 3; row++) for (let col = 0; col < 5 + row % 2; col++) for (let z = -1; z <= 1; z++) {
    if (row === 2 && col === 4 && z === -1) continue;
    const x0 = Math.max(-5.125, -5.125 + (col - (row % 2) * .5) * 2.05), x1 = Math.min(5.125, -5.125 + (col + 1 - (row % 2) * .5) * 2.05);
    put((col + z + 6) % 3, ax + (x0 + x1) / 2, floor + .4 + row * .75, az + z * 2.05, x1 - x0 - .06, .8, 2);
  }
  put(2, ax, floor + 2.65, az, 3.5, .55, 3.5);
  put(3, ax, floor + 3.65, az, 1.5, 1.7, 1.5);
  put(0, ax, floor + 4.55, az, 2.8, .45, 2.8);
  const center = floor + 6.3;
  put(ring, ax, center, az, 1.75, 1.75, 1.75, .45, .2);
  put(ring, ax, center, az, 1.45, 1.45, 1.45, -.6, -.4, 1.05);
  put(ring, ax, center, az, 1.05, 1.05, 1.05, .6, .2, .35);
  put(axis, ax, center, az, 1, 4.4, 1, 0, -.3);
  for (const side of [-1, 1]) marker(ax + side * 6.2, az + 2.7, 1.6, false);
  for (let i = 0; i < 11; i++) {
    const x = ax + Math.sin(i * 2.4) * (5.7 + i * .11), z = az + Math.cos(i * 2.4) * (4.4 + i * .12);
    put(i % 3, x, heightAt(x, z) + .16, z, .4 + (i % 3) * .17, .42, .65, i * .9, .13);
  }
  return { metalGeometries: [ring, axis], positions: { armillary: [ax, floor, az], leftObelisk: [-148, heightAt(-148, -430), -430], rightObelisk: [145, heightAt(145, -445), -445] } };
}
