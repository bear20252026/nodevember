import {
  Group, Mesh, MeshStandardNodeMaterial, CapsuleGeometry, CylinderGeometry,
  LatheGeometry, PlaneGeometry, Shape, ExtrudeGeometry, CanvasTexture,
  SRGBColorSpace, Vector2, Vector3, Matrix4, Object3D, FrontSide
} from 'three/webgpu';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// The visual assembly uses the same four wheel centers and .385 m rolling
// radius as the raycast vehicle. Detail never changes suspension contact.
export function createRoverModel() {
  const group = new Group(); group.name = 'M-15 desert survey rover';
  const body = new Group(); body.position.y = -1.1; group.add(body);
  const material = (color, roughness, metalness = 0) => new MeshStandardNodeMaterial({ color, roughness, metalness });
  const materials = {
    shell: material('#c7c4b2', .61, .13),
    trim: material('#9a9c92', .65, .22),
    frame: material('#536167', .66, .08),
    rubber: material('#303837', .95),
    tread: material('#55564b', .93),
    metal: material('#929b95', .39, .55),
    lens: material('#122a33', .18, .25),
    lamp: new MeshStandardNodeMaterial({ color: '#c8dfdf', emissive: '#8daeb4', emissiveIntensity: .6, roughness: .28 }),
    rear: new MeshStandardNodeMaterial({ color: '#b65a36', emissive: '#9a3b1d', emissiveIntensity: .35, roughness: .5 })
  };
  // Closed tires must shadow from the outer surface. Back-face-only casters
  // lose the contact edge when the receiver's slope bias raises it into a tire.
  materials.rubber.shadowSide = materials.tread.shadowSide = FrontSide;
  const round = new RoundedBoxGeometry(1, 1, 1, 3, .1);
  const bodyCore = new CapsuleGeometry(.5, 1, 6, 28); bodyCore.rotateX(Math.PI / 2);
  const bodyShell = new RoundedBoxGeometry(.90, .40, 1.55, 4, .17);
  const treadBlock = new RoundedBoxGeometry(1, 1, 1, 1, .1);
  const axle = new CylinderGeometry(1, 1, 1, 32); axle.rotateZ(Math.PI / 2);
  const bolt = new CylinderGeometry(1, 1, 1, 6); bolt.rotateZ(Math.PI / 2);
  const cylinder = new CylinderGeometry(1, 1, 1, 16);
  const pivotBushing = new LatheGeometry([
    [.019, -.0475], [.055, -.0475], [.055, .0475], [.019, .0475], [.019, -.0475]
  ].map(([r, x]) => new Vector2(r, x)), 24); pivotBushing.rotateZ(Math.PI / 2);
  const tire = new LatheGeometry([
    [.24, -.12], [.29, -.14], [.33, -.135], [.355, -.105],
    [.365, -.06], [.365, .06], [.355, .105], [.33, .135],
    [.29, .14], [.24, .12], [.24, -.12]
  ].map(([r, x]) => new Vector2(r, x)), 64); tire.rotateZ(Math.PI / 2);
  function armGeometry(profile, thickness) {
    const shape = new Shape();
    profile.forEach(([z, y], i) => i ? shape.lineTo(z, y) : shape.moveTo(z, y)); shape.closePath();
    const g = new ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: true, bevelSize: .014, bevelThickness: .012, bevelSegments: 2, steps: 1, curveSegments: 1 });
    g.translate(0, 0, -thickness / 2); g.rotateY(Math.PI / 2); return g;
  }
  const upperShape = armGeometry([[-.07, -.48], [.07, -.48], [.115, -.30], [.12, .32], [.07, .48], [-.07, .48], [-.12, .29], [-.10, -.25]], .17);
  const upperCover = armGeometry([[-.055, -.38], [.055, -.38], [.088, -.24], [.09, .27], [.05, .38], [-.05, .38], [-.085, .23], [-.075, -.23]], .018);
  const lowerShape = armGeometry([[-.07, -.48], [.07, -.48], [.11, -.27], [.075, .32], [.05, .48], [-.05, .48], [-.11, .27], [-.10, -.23]], .125);
  const geometries = [round, bodyCore, bodyShell, treadBlock, axle, bolt, cylinder, pivotBushing, tire, upperShape, upperCover, lowerShape];
  const textures = [], meshes = [], assemblies = new Map(), dummy = new Object3D();

  // Merge rigid pieces per material and articulation, rather than keeping
  // hundreds of bolts, tread blocks and vents as individual draw objects.
  function piece(geometry, mat, parent, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) {
    let buckets = assemblies.get(parent); if (!buckets) assemblies.set(parent, buckets = new Map());
    let pieces = buckets.get(mat); if (!pieces) buckets.set(mat, pieces = []);
    dummy.position.set(x, y, z); dummy.rotation.set(rx, ry, rz); dummy.scale.set(sx, sy, sz); dummy.updateMatrix();
    const g = geometry.index ? geometry.toNonIndexed() : geometry.clone(); g.applyMatrix4(dummy.matrix); pieces.push(g);
  }
  const rect = (mat, parent, x, y, z, w, h, d, rx = 0, ry = 0, rz = 0) => piece(round, mat, parent, x, y, z, w, h, d, rx, ry, rz);
  const disc = (mat, parent, x, y, z, length, radius, ry = 0) => piece(axle, mat, parent, x, y, z, length, radius, radius, 0, ry);
  const screw = (parent, x, y, z, radius = .019, ry = 0) => piece(bolt, materials.metal, parent, x, y, z, .012, radius, radius, 0, ry);
  function ring(parent, mat, x, radius, thickness, ry = 0) {
    const g = new LatheGeometry([[radius - thickness, -.012], [radius, -.012], [radius, .012], [radius - thickness, .012], [radius - thickness, -.012]].map(([r, a]) => new Vector2(r, a)), 48);
    g.rotateZ(Math.PI / 2); geometries.push(g); piece(g, mat, parent, x, 0, 0, 1, 1, 1, 0, ry);
  }

  // Recessed battery chassis, separate ceramic armor and metal skid plate.
  const rearExtension = .25;
  piece(bodyCore, materials.frame, body, 0, 1.13, rearExtension / 2, .82, .47, .87 + rearExtension / 2);
  rect(materials.trim, body, 0, .92, .02 + rearExtension / 2, .68, .075, 1.39 + rearExtension);
  piece(bodyShell, materials.shell, body, 0, 1.30, -.08 + rearExtension / 2, 1, 1, 1 + rearExtension / 1.55);
  rect(materials.rubber, body, 0, 1.485, .14 + rearExtension / 2, .65, .022, .82 + rearExtension);
  rect(materials.frame, body, 0, 1.501, .14 + rearExtension / 2, .60, .025, .76 + rearExtension);
  // Raised ribs keep the service lid legible from the chase camera.
  for (let i = 0; i < 6; i++) rect(materials.trim, body, 0, 1.518, -.10 + i * .15, .46, .012, .018);
  for (const side of [-1, 1]) {
    rect(materials.frame, body, side * .34, 1.49, .13 + rearExtension / 2, .047, .06, 1.03 + rearExtension);
    rect(materials.rubber, body, side * .443, 1.275, -.08 + rearExtension / 2, .024, .26, 1.07 + rearExtension);
    rect(materials.shell, body, side * .465, 1.29, -.26, .027, .22, .63);
    rect(materials.trim, body, side * .469, 1.29, .32, .03, .22, .36);
    for (let i = 0; i < 7; i++) rect(materials.frame, body, side * .488, 1.29, .19 + i * .042, .012, .13, .018);
    for (const z of [-.51, -.01]) for (const y of [1.21, 1.36]) screw(body, side * .485, y, z, .011);
    for (const z of [-.57, .57]) {
      disc(materials.frame, body, side * .47, 1.12, z, .20, .18);
      disc(materials.trim, body, side * .57, 1.12, z, .028, .145);
      disc(materials.frame, body, side * .59, 1.12, z, .025, .10);
      for (let j = 0; j < 6; j++) {
        const a = j / 6 * Math.PI * 2;
        screw(body, side * .61, 1.12 + Math.cos(a) * .123, z + Math.sin(a) * .123, .014);
      }
    }
    // Two protective bumper horns and low front lights, no oversized eyes.
    rect(materials.frame, body, side * .35, 1.1, -.80, .10, .18, .29, -.15);
    disc(materials.frame, body, side * .265, 1.31, -.84, .065, .078, Math.PI / 2);
    disc(materials.lamp, body, side * .265, 1.31, -.883, .012, .054, Math.PI / 2);
    rect(materials.rear, body, side * .34, 1.32, .818 + rearExtension, .066, .036, .015);
  }
  // Rear access hatch and cooling grilles make the driving view feel finished.
  rect(materials.rubber, body, 0, 1.19, .81 + rearExtension, .64, .29, .035);
  rect(materials.shell, body, 0, 1.18, .837 + rearExtension, .57, .23, .03);
  rect(materials.frame, body, 0, 1.03, .85 + rearExtension, .72, .08, .11);
  for (let i = 0; i < 8; i++) rect(materials.frame, body, -.23 + i * .066, 1.36, .80 + rearExtension, .038, .06, .018);
  for (const x of [-.24, .24]) for (const y of [1.10, 1.25]) screw(body, x, y, .859 + rearExtension, .012, Math.PI / 2);
  rect(materials.frame, body, .16, 1.12, .863 + rearExtension, .115, .022, .018);
  for (const x of [-.25, .25]) rect(materials.metal, body, x, .98, .876 + rearExtension, .075, .025, .025);

  // Integrated optics keep a low, rounded silhouette, like the reference.
  rect(materials.shell, body, 0, 1.42, -.82, .35, .15, .21);
  rect(materials.frame, body, 0, 1.42, -.931, .30, .105, .02);
  for (const side of [-1, 1]) {
    disc(materials.metal, body, side * .10, 1.42, -.948, .024, .04, Math.PI / 2);
    disc(materials.lens, body, side * .10, 1.42, -.964, .012, .029, Math.PI / 2);
  }
  rect(materials.lamp, body, 0, 1.455, -.947, .026, .009, .008);
  rect(materials.rubber, body, -.27, 1.52, .53 + rearExtension, .065, .07, .12);

  // A small generated stencil is the only bitmap on the rover.
  const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 256;
  const ctx = canvas.getContext('2d'); ctx.fillStyle = '#434c49';
  ctx.font = '600 116px monospace'; ctx.fillText('M–15', 18, 122);
  ctx.font = '32px monospace'; ctx.fillText('DESERT SURVEY / MIRAGE', 22, 188);
  ctx.fillRect(22, 216, 480, 6);
  for (let i = 0; i < 5; i++) ctx.fillRect(734 + i * 42, 24, 18, 181);
  const stencil = new CanvasTexture(canvas); stencil.colorSpace = SRGBColorSpace; stencil.anisotropy = 16; textures.push(stencil);
  materials.stencil = new MeshStandardNodeMaterial({ map: stencil, transparent: true, depthWrite: false, roughness: .8, polygonOffset: true, polygonOffsetFactor: -1 });
  const decal = new PlaneGeometry(1, 1); geometries.push(decal);
  function label(parent, x, y, z, w, h, ry = 0) {
    const m = new Mesh(decal, materials.stencil); m.position.set(x, y, z); m.scale.set(w, h, 1); m.rotation.y = ry; parent.add(m); meshes.push(m);
  }
  label(body, -.035, 1.19, .856 + rearExtension, .42, .105);
  for (const side of [-1, 1]) label(body, side * .481, 1.30, -.26, .49, .1225, side * Math.PI / 2);

  const legs = [];
  for (const side of [-1, 1]) for (const end of [-1, 1]) {
    const upper = new Group(), lower = new Group(), knee = new Group(); group.add(upper, lower, knee);
    piece(upperShape, materials.frame, upper, 0, 0, 0, 1, 1, 1);
    piece(upperCover, materials.shell, upper, side * .10, 0, 0, 1, 1, 1);
    rect(materials.trim, upper, side * .116, -.03, -.002, .011, .34, .035);
    for (const y of [-.29, .29]) screw(upper, side * .126, y, 0, .018);
    // The shin itself meets the hub. A short, smoothly flared ankle stays
    // inside the tire's central opening, avoiding a third horizontal link.
    const ankleShape = lowerShape.clone(), anklePositions = ankleShape.attributes.position;
    for (let i = 0; i < anklePositions.count; i++) {
      const t = Math.max(0, Math.min(1, (-.35 - anklePositions.getY(i)) / .13));
      anklePositions.setX(i, anklePositions.getX(i) + side * .14 * t * t * (3 - 2 * t));
    }
    ankleShape.computeVertexNormals(); geometries.push(ankleShape);
    piece(ankleShape, materials.frame, lower, 0, 0, 0, 1, 1, 1);
    rect(materials.trim, lower, side * .071, -.03, .014, .015, .46, .105);
    for (const y of [-.19, .22]) screw(lower, side * .087, y, .014, .017);
    disc(materials.frame, knee, 0, 0, 0, .24, .145);
    disc(materials.trim, knee, side * .13, 0, 0, .025, .121);
    disc(materials.frame, knee, side * .15, 0, 0, .025, .085);
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3;
      screw(knee, side * .17, Math.cos(a) * .103, Math.sin(a) * .103, .014);
    }
    const barrel = new Mesh(cylinder, materials.frame), piston = new Mesh(cylinder, materials.metal);
    for (const m of [barrel, piston]) { m.castShadow = m.receiveShadow = true; group.add(m); meshes.push(m); }
    const shockMount = new Group(); group.add(shockMount);
    // A through-pin in an open bushing, with a proud hex head. Keep the
    // mating surfaces separated and the small joint intact through LODs.
    shockMount.userData.preserveSurface = true;
    piece(pivotBushing, materials.frame, shockMount, 0, 0, 0, 1, 1, 1);
    disc(materials.metal, shockMount, 0, 0, 0, .11, .0175);
    piece(bolt, materials.metal, shockMount, -side * .058, 0, 0, .020, .024, .024);
    const wheel = new Group(), spin = new Group(); spin.userData.contactWheel = true; wheel.add(spin); group.add(wheel);
    piece(tire, materials.rubber, spin, 0, 0, 0, 1, 1, 1);
    disc(materials.frame, spin, 0, 0, 0, .19, .255);
    disc(materials.trim, spin, side * .107, 0, 0, .024, .238);
    disc(materials.shell, spin, side * .124, 0, 0, .014, .191);
    disc(materials.frame, spin, side * .145, 0, 0, .043, .078);
    disc(materials.metal, spin, side * .17, 0, 0, .014, .046);
    ring(spin, materials.metal, side * .133, .238, .012);
    ring(spin, materials.tread, side * .143, .306, .008);
    for (let i = 0; i < 10; i++) {
      const a = i * Math.PI / 5;
      screw(spin, side * .143, Math.cos(a) * .211, Math.sin(a) * .211, .012);
      rect(materials.frame, spin, side * .137, Math.cos(a) * .148, Math.sin(a) * .148, .007, .022, .037, a);
    }
    // Paired angled blocks form a continuous tire rather than a paddle wheel.
    // Maximum radial extent stays within the physics wheel radius (0.385 m).
    for (let i = 0; i < 48; i++) for (const half of [-1, 1]) {
      const a = i / 48 * Math.PI * 2;
      piece(treadBlock, materials.tread, spin, half * .062, Math.cos(a) * .373, Math.sin(a) * .373, .133, .022, .032, a, half * .36);
    }
    legs.push({ side, end, upper, lower, knee, wheel, spin, barrel, piston, shockMount, hip: new Vector3(), bend: new Vector3(), foot: new Vector3(), knuckle: new Vector3(), shockTop: new Vector3(), shockEnd: new Vector3() });
  }
  for (const [parent, buckets] of assemblies) for (const [mat, pieces] of buckets) {
    const g = mergeGeometries(pieces); pieces.forEach(p => p.dispose()); geometries.push(g);
    if (parent.userData.preserveSurface) g.userData.preserveSurface = true;
    if (parent.userData.contactWheel && (mat === materials.rubber || mat === materials.tread)) g.userData.preserveSurface = true;
    const mesh = new Mesh(g, mat); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); meshes.push(mesh);
  }
  assemblies.clear();
  for (const geometry of geometries) geometry.userData.meshletFamily = 'rover';
  const direction = new Vector3(), up = new Vector3(0, 1, 0), shockJoin = new Vector3();
  const axleAxis = new Vector3(), depthAxis = new Vector3(), legBasis = new Matrix4();
  function link(object, a, b, width = 1, depth = width) {
    direction.subVectors(b, a); object.position.copy(a).add(b).multiplyScalar(.5);
    object.scale.set(width, direction.length(), depth); object.quaternion.setFromUnitVectors(up, direction.normalize());
  }
  function pose(physics) {
    group.position.fromArray(physics.position); group.quaternion.fromArray(physics.rotation);
    for (let i = 0; i < legs.length; i++) {
      const leg = legs[i], state = physics.wheels[i];
      // Attach at the shoulder bearing's outer face, preserving the original
      // leg fold while reducing how much the upper arm enters the body.
      leg.hip.set(leg.side * .58, .02, leg.end * .57);
      leg.foot.set(leg.side, .10 - state.length, leg.end * .92);
      leg.knuckle.copy(leg.foot);
      const cs = Math.cos(state.angle), sn = Math.sin(state.angle);
      leg.knuckle.x -= leg.side * .27 * cs;
      leg.knuckle.z += leg.side * .27 * sn;
      // Two links: the shoulder splays outward, then the shin descends in
      // the inboard wheel plane. Steering rotates that plane, preserving
      // tire clearance without an extra link or a collapsed resting stance.
      const dy = -.28 + (leg.foot.y + .66) * .35 - leg.foot.y, dz = -leg.end * .57;
      leg.bend.set(-leg.side * .27 * cs + dz * sn, dy, leg.side * .27 * sn + dz * cs).add(leg.foot);
      // Point each link's local +Y toward the body so its outside armor
      // remains outward as the suspension compresses and extends.
      link(leg.upper, leg.bend, leg.hip, 1, .85);
      link(leg.lower, leg.knuckle, leg.bend);
      axleAxis.set(cs, 0, -sn); depthAxis.crossVectors(axleAxis, direction).normalize();
      legBasis.makeBasis(axleAxis, direction, depthAxis); leg.lower.quaternion.setFromRotationMatrix(legBasis);
      leg.knee.position.copy(leg.bend); leg.knee.rotation.y = state.angle;
      leg.shockTop.copy(leg.hip); leg.shockTop.x -= leg.side * .12; leg.shockTop.z += leg.end * .08;
      // Transform a real mounting point on the shin. Offsetting in chassis X
      // left the piston floating beside the arm when the wheel steered.
      leg.lower.updateMatrix();
      leg.shockEnd.set(-leg.side * .085, -.10, 0).applyMatrix4(leg.lower.matrix);
      leg.shockMount.position.copy(leg.shockEnd); leg.shockMount.quaternion.copy(leg.lower.quaternion);
      shockJoin.lerpVectors(leg.shockTop, leg.shockEnd, .58);
      link(leg.barrel, leg.shockTop, shockJoin, .036); link(leg.piston, shockJoin, leg.shockEnd, .016);
      leg.wheel.position.copy(leg.foot); leg.wheel.rotation.y = state.angle; leg.spin.rotation.x = state.spin;
    }
    group.updateMatrixWorld(true);
  }
  return { group, legs, pose, instances: meshes.filter(m => !m.material.transparent).length,
    dispose() { geometries.forEach(g => g.dispose()); textures.forEach(t => t.dispose()); Object.values(materials).forEach(m => m.dispose()); }
  };
}
