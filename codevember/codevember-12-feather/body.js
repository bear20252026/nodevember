import * as THREE from 'three';

// The shape of the body, from a ball to a bare bird. Feathered, the creature is a ball (an
// ellipsoid of skin under a thick coat); plucked, it is what was under all that: a pear of
// a body narrowing to a long thin neck and a small head on top, taller than the ball was
// (the bare one of image 1). The shape in between is the two blended by `m` (0 ball …
// 1 bare).
//
// Both are drawn over the same parameters, a direction on the unit sphere (its angle from
// the top θ, its turn round from the front φ), so a point of skin, and the feather
// growing from it, the follicles, the ring round the eyes, the hips, keep their place on
// the body as it changes. The ball has them where a direction meets the ellipsoid; the
// bare body is a surface of revolution (a little deeper than wide) whose profile is
// spread over θ unevenly: the upper half of the ball (the face, the crown) becomes the
// head, a narrow band under the eyes becomes the neck, the rest the body. The feathers of
// the crown, squeezed onto the small head, are shortened in proportion (`stretch`).

export const BALL = new THREE.Vector3(0.44, 0.52, 0.44);

const DEG = Math.PI / 180;
// the head: an oval round (0, HEAD.y, HEAD.z), its own angle from the top α spread over
// the ball's θ from 0 to 100°, the ball's eyes (θ 75°) at the head's middle
const HEAD = { y: 0.86, z: 0.035, rx: 0.16, ry: 0.18, rz: 0.17 };
const alphaOf = (t) => (t < 75 ? t * (90 / 75) : 90 + (t - 75) * (52 / 25));
// the profile, keyed on θ (degrees): height, half width, half depth, forward shift
const KEYS = [];
for (let t = 0; t <= 100; t += 5) {
  const a = alphaOf(t) * DEG;
  KEYS.push([t, HEAD.y + HEAD.ry * Math.cos(a), HEAD.rx * Math.sin(a), HEAD.rz * Math.sin(a), HEAD.z]);
}
KEYS.push(
  // the throat, the neck, thin and a little forward at the top
  [107, 0.69, 0.07, 0.075, 0.03],
  [113, 0.6, 0.05, 0.054, 0.024],
  [120, 0.44, 0.046, 0.05, 0.012],
  // the shoulders sloping, the pear, its belly hanging low
  [127, 0.27, 0.08, 0.08, 0.0],
  [135, 0.11, 0.14, 0.13, -0.005],
  [145, -0.08, 0.195, 0.175, 0.005],
  [155, -0.25, 0.205, 0.185, 0.018],
  [164, -0.38, 0.16, 0.15, 0.02],
  [172, -0.455, 0.09, 0.085, 0.012],
  [180, -0.48, 0.0, 0.0, 0.005],
);
// a smooth (Hermite) curve through the keys, with slopes from the neighbours
const SLOPES = KEYS.map((k, i) => {
  const a = KEYS[Math.max(i - 1, 0)], b = KEYS[Math.min(i + 1, KEYS.length - 1)];
  return k.map((_, j) => (j === 0 ? 0 : (b[j] - a[j]) / (b[0] - a[0])));
});
const prof = [0, 0, 0, 0, 0];
function profile(tDeg) {
  let i = 0;
  while (i < KEYS.length - 2 && KEYS[i + 1][0] < tDeg) i++;
  const a = KEYS[i], b = KEYS[i + 1], sa = SLOPES[i], sb = SLOPES[i + 1];
  const h = b[0] - a[0], u = Math.min(Math.max((tDeg - a[0]) / h, 0), 1);
  const u2 = u * u, u3 = u2 * u;
  const h00 = 2 * u3 - 3 * u2 + 1, h10 = u3 - 2 * u2 + u, h01 = -2 * u3 + 3 * u2, h11 = u3 - u2;
  for (let j = 1; j < 5; j++) prof[j] = h00 * a[j] + h10 * h * sa[j] + h01 * b[j] + h11 * h * sb[j];
  return prof;
}

// the point of skin at (θ, φ), for the blend m
function pointTP(th, ph, m, out) {
  const st = Math.sin(th), ct = Math.cos(th), sp = Math.sin(ph), cp = Math.cos(ph);
  const dx = st * sp, dy = ct, dz = st * cp;
  const s = 1 / Math.sqrt((dx / BALL.x) ** 2 + (dy / BALL.y) ** 2 + (dz / BALL.z) ** 2);
  const bx = dx * s, by = dy * s, bz = dz * s;
  if (m <= 0) return out.set(bx, by, bz);
  const p = profile(th / DEG);
  const tx = p[2] * sp, ty = p[1], tz = p[3] * cp + p[4];
  return out.set(bx + (tx - bx) * m, by + (ty - by) * m, bz + (tz - bz) * m);
}

const pA = new THREE.Vector3(), pB = new THREE.Vector3(), dT = new THREE.Vector3(), dP = new THREE.Vector3();
const E = 1e-3;

// the skin at the direction `dir` (unit) for the blend m: its point, its normal, and how
// much a small patch of it is stretched against the ball's (area ratio)
export function skinAt(dir, m, outP, outN) {
  const th = Math.acos(THREE.MathUtils.clamp(dir.y, -1, 1));
  const ph = Math.atan2(dir.x, dir.z);
  pointTP(th, ph, m, outP);
  if (!outN) return outP;
  const tc = THREE.MathUtils.clamp(th, 0.02, Math.PI - 0.02);
  pointTP(tc + E, ph, m, pA); pointTP(tc - E, ph, m, pB); dT.subVectors(pA, pB);
  pointTP(tc, ph + E, m, pA); pointTP(tc, ph - E, m, pB); dP.subVectors(pA, pB);
  outN.crossVectors(dT, dP);
  const area = outN.length();
  outN.multiplyScalar(1 / Math.max(area, 1e-12));
  return area / (4 * E * E * Math.sin(tc));
}

// how much the bare body is stretched (area) against the ball at dir
const nTmp = new THREE.Vector3(), pTmp = new THREE.Vector3();
export function stretch(dir) {
  return skinAt(dir, 1, pTmp, nTmp) / skinAt(dir, 0, pTmp, nTmp);
}

// the skin's mesh: a sphere whose vertices are moved to the shape, keeping their
// direction as `param` (for the follicles, the eye rings…)
export class BodyGeometry extends THREE.SphereGeometry {
  constructor(ws = 128, hs = 112) {
    super(1, ws, hs);
    this.setAttribute('param', this.attributes.position.clone());
    this.m = -1;
    this.set(0);
  }
  set(m) {
    if (Math.abs(m - this.m) < 0.002) return;
    this.m = m;
    const par = this.attributes.param, pos = this.attributes.position, nor = this.attributes.normal;
    const d = new THREE.Vector3(), p = new THREE.Vector3(), n = new THREE.Vector3();
    for (let i = 0; i < par.count; i++) {
      d.fromBufferAttribute(par, i).normalize();
      skinAt(d, m, p, n);
      // the poles' vertices are one point: one normal for them all (anything pushed along
      // it, as the skin is round the hips, would otherwise open a hole there)
      if (Math.abs(d.y) > 0.99999) n.set(0, Math.sign(d.y), 0);
      pos.setXYZ(i, p.x, p.y, p.z);
      nor.setXYZ(i, n.x, n.y, n.z);
    }
    pos.needsUpdate = true;
    nor.needsUpdate = true;
    this.computeBoundingSphere();
  }
}
