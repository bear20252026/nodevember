const assert = (value, message) => { if (!value) throw new Error(message); };

export function checkTerrain(app = window.mirage) {
  const { landscape } = app, report = [];
  for (const mesh of [landscape.ground, ...landscape.distanceTerrain]) {
    const geometry = mesh.geometry, p = geometry.attributes.position, n = geometry.attributes.normal, index = geometry.index.array;
    const used = new Set(index); let maximumContactError = 0;
    for (const i of used) {
      assert(Number.isFinite(p.getX(i) + p.getY(i) + p.getZ(i)), `${mesh.name}: invalid vertex`);
      assert(Math.abs(Math.hypot(n.getX(i), n.getY(i), n.getZ(i)) - 1) < .001, `${mesh.name}: invalid normal`);
    }
    // Test actual triangle interiors, including the differently tessellated
    // transition strip. Testing only ring vertices misses broken collisions.
    const triangles = [];
    for (let i = 0; i < index.length; i += 3 * 137) triangles.push([index[i], index[i + 1], index[i + 2]]);
    if (mesh.userData.grid) {
      const stitch = new Set(mesh.userData.grid.stitches.flat(2));
      for (const triangle of stitch) triangles.push(triangle);
    }
    for (const [a, b, c] of triangles) {
      const x = (p.getX(a) + p.getX(b) + p.getX(c)) / 3;
      const z = (p.getZ(a) + p.getZ(b) + p.getZ(c)) / 3;
      const y = (p.getY(a) + p.getY(b) + p.getY(c)) / 3;
      const area = (p.getX(b) - p.getX(a)) * (p.getZ(c) - p.getZ(a)) - (p.getX(c) - p.getX(a)) * (p.getZ(b) - p.getZ(a));
      assert(area < 0, `${mesh.name}: collapsed or reversed terrain triangle`);
      maximumContactError = Math.max(maximumContactError, Math.abs(landscape.heightAt(x, z) - y));
    }
    assert(maximumContactError < .01, `${mesh.name}: terrain/physics mismatch ${maximumContactError}`);
    assert(app.meshlets._getClusters(geometry).lodCount === 1, `${mesh.name}: surface changes at LOD boundaries`);
    report.push({ name: mesh.name, trianglesChecked: triangles.length, maximumContactError });
  }
  return report;
}
