import * as THREE from 'three';
import { FeatherMesh, setFlow } from './feather.js';
import { rng } from './common.js';
import { skinAt, stretch } from './body.js';
import { namedPlumage } from './plumage.js';
import { CHARACTERS, CHARACTER_NAMES, SECONDARY_AREAS, DISPLAY_SITES, DISPLAY_SHAPES, DISPLAY_SHAPE_NAMES } from './characters.js';

// The coat: where each feather grows on the body, how it sways while it holds, when it
// lets go, and how it flies and settles once free.
//
// Layout. The feathers grow from the skin (an ellipsoid, see creature.js), spread evenly
// (a Fibonacci lattice, jittered), none over the eyes. Each lies along the coat's flow,
// which runs away from the eyes and down the back and flanks, rising from the down at 55° or so and curling back
// towards it, long enough for its tip to reach the coat's outer surface: a ball of 0.92,
// pressed in round the eyes. Round the eyes, as on a real bird, no feathers of the bird's
// types but a dense felt of tiny hair-like ones radiating from each (pointed, narrow, all
// leaning alike like a combed pile, a shade darker at the rim, up over the forehead between the eyes), short at
// the eye's rim, longer outwards; there turning, by degrees, into small feathers of the
// bird's types (shape, length, lean, depth, colour, marks all following the distance from
// the eye), growing to the coat's size, so the face fades into the coat. Under the
// contour feathers, the down: many small soft white feathers, domed and curled over,
// packed in layers into a soft volume peeking between them.
// Three types of contour feathers, each with its character (characters.js: proud,
// aggressive, cute), drawn anew for each bird: the main type over most of the body, a
// secondary type over one area (the front, a cape over the crown and shoulders, the
// flanks or the belly), the two mingling where they meet; and a few
// display feathers standing out of the coat, both at the back (a cocked tail) and over the
// eyes (brows), some birds a crest as well, each site in one of the wilder shapes
// (characters.js: racket, curl, wisp, sickle, ribbon, coil). Colours by region (crown and back, face, breast, belly) from the
// plumage (plumage.js): each feather takes one region's colours, chosen at random by how
// much it lies in it, so the regions meet in a ragged mosaic rather than a blur; the
// display feathers their own.
//
// Holding on. Each attached feather is a damped spring (its own pitch and damping) pushed
// by the inertia of the body (gravity minus its acceleration, in the feather's frame): the
// coat ripples as the creature is swung. A feather wears loose under hard shaking: the
// acceleration above its grip, integrated over time, loosens it (it sticks out more and
// more, the coat gets ruffled) until it lets go, with the body's velocity and a flick.
// The longer, outer feathers go first, the down last.
//
// Free. A feather in the air is a light plate: strong drag across its face, little along
// it, so it falls slowly and glides sideways where it is tilted; turned broadside to the
// air by it, its tip trailing (the quill is heavier), it rocks and spins as it comes down,
// bending with the air on its face. The air moves with the body as it passes and with
// the pointer swept through it, which lifts feathers off the floor again. On the floor
// they settle flat.
//
// Stroked. The pointer passed over the coat (not holding it) runs through it like a
// finger: the feathers under it part round it and dip a little, are dragged along
// sideways, lie flatter stroked with the grain and stand up stroked against it, staying
// ruffled a while after (combed flat again by a stroke the right way); a rough stroke
// against the grain picks out a feather that was already loose.
//
// Recovery, all at once: POOF. The fallen feathers vanish but a few, flung off spinning
// and dwindling as they go; in the same instant the missing ones are back on the body,
// full size at once (no growing), in a puff of down bursting out of the coat. A molt
// poofs the whole coat away, the feathers on the body too, for a new coat (another
// bird's, see main.js) to pop out of the bare skin.

const tmpQ = new THREE.Quaternion();
const tmpM = new THREE.Matrix4();
const vA = new THREE.Vector3(), vB = new THREE.Vector3(), vC = new THREE.Vector3();

export const PALETTES = {
  // crown/back, face, breast, belly, the display feathers: vane colour, fringe colour, band strength
  ember: {
    back: ['#5a4127', '#c9a774', 0.35], face: ['#d8692a', '#f2b072', 0.0],
    breast: ['#e07a32', '#f4c08a', 0.1], belly: ['#e8dcc4', '#fbf4e6', 0.0], display: ['#2a7f8a', '#f2d27a', 0.5], skin: '#f1c4b6',
  },
  frost: {
    back: ['#4d5d73', '#c7d2de', 0.45], face: ['#eef0f2', '#ffffff', 0.0],
    breast: ['#b9c3cc', '#f2f5f7', 0.2], belly: ['#f1f1ee', '#ffffff', 0.0], display: ['#2f4fa8', '#c9dbff', 0.4], skin: '#efc3bf',
  },
  rose: {
    back: ['#8c8d96', '#d9dae0', 0.25], face: ['#f2b8c6', '#fbe1e8', 0.0],
    breast: ['#d8577a', '#f09ab0', 0.05], belly: ['#cf4f72', '#ea8fa6', 0.0], display: ['#3d2b5c', '#f2b8c6', 0.5], skin: '#f3c0ba',
  },
  lemon: {
    back: ['#7d7a2a', '#d8d06a', 0.3], face: ['#f6d32a', '#fff08a', 0.0],
    breast: ['#f3c41c', '#ffe680', 0.0], belly: ['#f8e27a', '#fff6c4', 0.0], display: ['#d2451e', '#ffd36a', 0.4], skin: '#f4cbb0',
  },
  owl: {
    back: ['#ece8df', '#ffffff', 0.75], face: ['#f7f5f0', '#ffffff', 0.0],
    breast: ['#efebe3', '#ffffff', 0.55], belly: ['#f6f3ee', '#ffffff', 0.25], display: ['#6b4a2e', '#f3e6cf', 0.8], skin: '#f0c6b8',
  },
};

// the attributes set once per feather (when it grows), not every frame
const STATIC = ['iShape', 'iCurve', 'iLook', 'iPat', 'iForm', 'iColA', 'iColB', 'iColC', 'iColD', 'iMark'];

// a little helper on flat arrays: quaternion rotation of v by q (all [x,y,z(,w)])
function qrot(qx, qy, qz, qw, x, y, z, out, o) {
  const tx = 2 * (qy * z - qz * y), ty = 2 * (qz * x - qx * z), tz = 2 * (qx * y - qy * x);
  out[o] = x + qw * tx + (qy * tz - qz * ty);
  out[o + 1] = y + qw * ty + (qz * tx - qx * tz);
  out[o + 2] = z + qw * tz + (qx * ty - qy * tx);
}
const R = new Float32Array(3);

// the shaft's curve, as the vertex shader has it (feather.js): its angle from the base
// plane along t, and where its tip ends (y along, z out, units of L)
const smooth = (a, b, x) => { const t = Math.min(Math.max((x - a) / (b - a), 0), 1); return t * t * (3 - 2 * t); };
const shaftAngle = (c, t) => c[0] - (c[0] - c[1]) * smooth(0, c[2], t) - c[3] * Math.max(t - c[2] * 0.6, 0);
function shaftAt(c, t) {
  let y = 0, z = 0;
  const h = t / 8;
  for (let i = 0; i < 8; i++) {
    const a = shaftAngle(c, (i + 0.5) * h);
    y += Math.cos(a) * h;
    z += Math.sin(a) * h;
  }
  return [y, z];
}

export class Coat {
  // `plumage`: from plumage.js; or a named palette
  // `bare`: nothing on the body yet (grown with regrow())
  constructor(creature, { seed = 1, contour = 900, down = 450, face = 3000, palette = 'ember', plumage = null, looks = {}, bare = false } = {}) {
    this.creature = creature;
    this.random = rng(seed * 7919 + 13);
    this.plumage = plumage || namedPlumage(PALETTES[palette] || PALETTES.ember);
    // its three types (given, or drawn from the seed, the secondary unlike the main)
    const pick = (list) => list[Math.floor(this.random() * list.length) % list.length];
    const valid = (c) => (CHARACTERS[c] ? c : null);
    const primary = valid(looks.primary) || pick(CHARACTER_NAMES);
    const secondary = valid(looks.secondary) || pick(CHARACTER_NAMES.filter((c) => c !== primary));
    const display = valid(looks.display) || pick(CHARACTER_NAMES);
    const area = SECONDARY_AREAS[looks.area] ? looks.area : pick(Object.keys(SECONDARY_AREAS));
    // its display sites: given ('tail+brows', 'none'…), or the tail and the brows, a
    // crest now and then (tufts: the brows' old name)
    const given = looks.site === 'none' ? [] : (looks.site || '').split(/[+, ]/).map((x) => (x === 'tufts' ? 'brows' : x)).filter((x) => DISPLAY_SITES.includes(x));
    const sites = looks.site === 'none' || given.length ? given : ['tail', 'brows', ...(this.random() < 0.3 ? ['crest'] : [])];
    // a shape per site (given by &shape=, for all), the brows' often unlike the tail's
    // (or per site: &shape=tail:wisp+crest:sickle)
    const per = Object.fromEntries((looks.shape || '').split(/[+, ]/).map((x) => x.split(':')).filter((x) => x.length === 2 && DISPLAY_SHAPES[x[1]]));
    const shapes = {};
    for (const st of sites) {
      shapes[st] = per[st] ? per[st] : DISPLAY_SHAPES[looks.shape] ? looks.shape
        : st !== 'tail' && shapes.tail && this.random() < 0.35 ? shapes.tail : pick(DISPLAY_SHAPE_NAMES);
    }
    this.looks = { primary, secondary, display, area, sites, shapes };
    this.build(contour, down, face);
    this.max = this.n * 3;
    this.feathers = new FeatherMesh(this.max);
    this.mesh = this.feathers.mesh;
    this.alloc();
    this.wind = { body: true, pointer: null };
    // the pointer on the coat: where (p), moving how over it (v, against the body), how
    // much (on), and how hard it rubs (for the rustle)
    this.touch = { on: 0, p: new THREE.Vector3(), last: null, v: new THREE.Vector3(), r: 0.17, rub: 0 };
    this.time = 0;
    if (!bare) for (let i = 0; i < this.n; i++) this.assign(i, i, 1);
    this.feathers.touch(...STATIC);
  }

  // ---- the layout -------------------------------------------------------------------
  build(nContour, nDown, nFace = 3000) {
    const random = this.random;
    const cr = this.creature;
    const radii = cr.skinRadii;
    const eyes = cr.eyeDirs;
    const nDisplay = 40;
    const nSmall = Math.round(nContour * 0.6);
    const n = nContour + nDown + nFace + nSmall + nDisplay;
    this.n = n;
    this.nContour = nContour;
    const T = {
      anchor: new Float32Array(n * 3), qLocal: new Float32Array(n * 4), shape: new Float32Array(n * 4),
      look: new Float32Array(n * 4), curve: new Float32Array(n * 4), lift: new Float32Array(n), pat: new Float32Array(n * 4), form: new Float32Array(n * 4), flow: new Float32Array(n * 4),
      colA: new Float32Array(n * 3), colB: new Float32Array(n * 3), colC: new Float32Array(n * 3), colD: new Float32Array(n * 3), mark: new Float32Array(n * 4), sheen: new Float32Array(n * 2),
      grip: new Float32Array(n), hold: new Float32Array(n), omega: new Float32Array(n), zeta: new Float32Array(n),
      area: new Float32Array(n),
      // on the bare body (see body.js): where it grows, turned how, its length scaled by
      anchor1: new Float32Array(n * 3), qLocal1: new Float32Array(n * 4), scale1: new Float32Array(n),
    };
    this.tpl = T;
    const regions = this.plumage.regions;
    const looks = this.looks;
    const inArea = SECONDARY_AREAS[looks.area];
    const white = new THREE.Color(0.95, 0.94, 0.92);
    const nrm = new THREE.Vector3(), d = new THREE.Vector3(), flow = new THREE.Vector3(), tmp = new THREE.Vector3();
    const x = new THREE.Vector3(), z = new THREE.Vector3(), A = new THREE.Vector3();
    const down = new THREE.Vector3(0, -1, 0), front = new THREE.Vector3(0, 0.1, 1).normalize();
    const cA = new THREE.Color(), hsl = {};
    // the coat's movement: which way the feathers sweep. Mostly one way, the coat combed
    // back and down towards the tail (each feather curving the way its side of it goes,
    // ax its sideways axis), with broad waves over the body (the two sides mirrored) and
    // a little each their own
    const ph = [random() * 6.28, random() * 6.28];
    const combTo = new THREE.Vector3(0, -0.45, -1).normalize();
    const sweepAt = (dr, ax) => {
      const comb = THREE.MathUtils.clamp(ax.dot(combTo) * 2.4, -1, 1);
      const wave = (Math.sin(3.3 * Math.abs(dr.x) + 2.1 * dr.y + ph[0]) * 0.6 + Math.sin(2.2 * dr.z - 3.7 * dr.y + ph[1]) * 0.4) * (dr.x < 0 ? -1 : 1);
      return THREE.MathUtils.clamp(comb * 0.8 + wave * 0.3, -1, 1);
    };
    const flowOf = (ch, sw, scale) => {
      const sweep = ch.flow * scale * (sw * 0.9 + (random() - 0.5) * 0.18);
      // the S bowing against the sweep
      const sc = -Math.sign(sweep || 1) * ch.scurve * scale * (0.6 + random() * 0.5);
      return [sweep, sc, Math.min(1, ch.locks * (0.7 + random() * 0.6)), ch.stir * (0.7 + random() * 0.6)];
    };
    const proj = (v, nn, out) => out.copy(v).addScaledVector(nn, -v.dot(nn));

    let k = 0;
    // the angle from the nearer eye
    const eyeAngle = (dir) => {
      let a = 9;
      for (const e of eyes) a = Math.min(a, Math.acos(Math.min(1, dir.dot(e))));
      return a;
    };
    // the beak pokes out of the face's hairs: none of them lying over it
    const beak = cr.beakDir, BEAK_CLEAR = Math.cos(0.12);
    // the face: the ring round each eye where the hairs grow, from the eye's rim (FACE_IN)
    // out under the first contour feathers (FACE_OUT); the share of the sphere it covers
    // round it, the small contour feathers (SMALL_IN to SMALL_OUT, from a denser lattice
    // too): from the hairs' size up to the coat's, a transition rather than an edge
    const FACE_IN = 0.29, FACE_OUT = 0.52, SMALL_IN = 0.4, SMALL_OUT = 0.72, CONTOUR_IN = 0.64;
    const share = (lo, hi) => {
      const g = Math.PI * (3 - Math.sqrt(5)), N = 4000;
      let c = 0;
      for (let i = 0; i < N; i++) {
        const yy = 1 - (i + 0.5) / N * 2, rr = Math.sqrt(1 - yy * yy);
        const a = eyeAngle(vA.set(Math.cos(i * g) * rr, yy, Math.sin(i * g) * rr));
        if (a >= lo && a <= hi) c++;
      }
      return Math.max(c / N, 0.01);
    };
    const faceShare = share(FACE_IN, FACE_OUT), smallShare = share(SMALL_IN, SMALL_OUT);
    // the hairs round the eyes: not feathers of the bird's types but bristles, narrow,
    // pointed, closed, a little glossy
    const HAIR = { width: 0.075, tip: 1.4, cup: 0, twist: 0, fray: 0.0, splits: 0.0, sheen: 1.3, barbs: 1.4, lift: 0, reach: 0,
      // still: no sweep, S, strands or stir, a combed pile
      flow: 0, scurve: 0, locks: 0, stir: 0 };
    // a character between two
    const mixCh = (a, b, t) => Object.fromEntries(Object.keys(HAIR).map((key) => [key, a[key] + (b[key] - a[key]) * t]));

    // kind: 'contour' over the body (the face left to the next), 'face' the tiny hair-like
    // feathers round the eyes (from a much denser lattice, only its ring round the eyes
    // kept), 'small' the smaller contour feathers round them (the same, less dense),
    // 'down' under the contour feathers
    const place = (count, kind) => {
      const isDown = kind === 'down', isFace = kind === 'face', isSmall = kind === 'small';
      const golden = Math.PI * (3 - Math.sqrt(5));
      const off = random() * 6.28;
      // a few more than needed, the eyes take some; for the face, enough for its ring
      const m = Math.ceil(isFace ? count / faceShare * 1.04 : isSmall ? count / smallShare * 1.04 : count * 1.06);
      const stop = k + count;
      for (let i = 0; k < stop && i < m; i++) {
        // jittered Fibonacci lattice over the sphere of directions
        const yy = 1 - (i + 0.5 + (random() - 0.5) * 0.8) / m * 2;
        if (yy < -1 || yy > 1) continue;
        const rr = Math.sqrt(1 - yy * yy);
        // (the hairs' lattice is so dense the others' jitter would be many times their
        // spacing, landing hairs on top of each other where they fight in depth: theirs a
        // fraction of it)
        const ph = i * golden + off + (random() - 0.5) * (isFace || isSmall ? 0.6 * Math.sqrt(4 * Math.PI / m) / Math.max(rr, 0.2) : 0.25);
        const dir = tmp.set(Math.cos(ph) * rr, yy, Math.sin(ph) * rr).normalize();
        // no feathers over the eyes; round them only the hairs (the down kept out from
        // under them too, they cover the skin themselves)
        const eyeAng = eyeAngle(dir);
        if (eyeAng < FACE_IN) continue;
        if (isFace ? eyeAng > FACE_OUT : isSmall ? eyeAng < SMALL_IN || eyeAng > SMALL_OUT : eyeAng < (isDown ? 0.62 : CONTOUR_IN)) continue;
        // on the skin
        A.copy(dir).multiplyScalar(1 / Math.sqrt((dir.x / radii.x) ** 2 + (dir.y / radii.y) ** 2 + (dir.z / radii.z) ** 2));
        const skin0 = A.length();
        nrm.set(A.x / radii.x ** 2, A.y / radii.y ** 2, A.z / radii.z ** 2).normalize();

        // the flow: away from each eye, then down and back
        flow.set(0, 0, 0);
        for (const e of eyes) {
          const w = Math.pow((1 + dir.dot(e)) / 2, 6) * 3;
          flow.addScaledVector(proj(e, nrm, d).negate().normalize(), w);
        }
        // and away from the middle of the face, between the eyes
        flow.addScaledVector(proj(front, nrm, d).negate().normalize(), 0.35 + Math.pow((1 + dir.dot(front)) / 2, 40) * 3);
        flow.addScaledVector(proj(down, nrm, d), 0.55);
        // the hairs between the eyes up over the forehead, not parting bare from a point
        if (isFace || isSmall) flow.addScaledVector(proj(vC.set(0, 1, -0.3), nrm, d), 1.4 * (1 - THREE.MathUtils.smoothstep(Math.abs(dir.x), 0.04, 0.22)) * THREE.MathUtils.smoothstep(dir.y, -0.25, 0.05));
        // underneath, back towards the tail end rather than all into one point
        flow.addScaledVector(proj(vC.set(0, -0.3, -1), nrm, d), 0.6 * THREE.MathUtils.smoothstep(-dir.y, 0.6, 0.95));
        flow.x += (random() - 0.5) * 0.12;
        flow.y += (random() - 0.5) * 0.12;
        flow.z += (random() - 0.5) * 0.12;
        proj(flow, nrm, flow);
        if (flow.lengthSq() < 1e-4) proj(down, nrm, flow);
        flow.normalize();

        const face = 1 - THREE.MathUtils.smoothstep(eyeAng, 0.3, 0.95);
        // round the eyes, the hairs and the small feathers are one continuum, everything
        // about them following how far from the eye they grow (g: 0 at its rim, 1 where
        // the coat begins): from a hair (u 0) to a feather of the bird's types (u 1), so
        // where the two kinds meet they are alike
        const faceish = isFace || isSmall;
        const g = THREE.MathUtils.smoothstep(eyeAng, FACE_IN, 0.66);
        const u = faceish ? THREE.MathUtils.smoothstep(g, 0.15, 1) : 1;
        // which type: the secondary over its area, the main elsewhere (round the eyes,
        // turning into it from a hair)
        const typeCh = CHARACTERS[!isDown && random() < inArea(dir) ? looks.secondary : looks.primary];
        const ch = faceish ? mixCh(HAIR, typeCh, u) : typeCh;
        // its frame: along the flow, out from the skin
        z.copy(nrm);
        x.crossVectors(flow, z);
        tmpM.makeBasis(x, flow, z);
        tmpQ.setFromRotationMatrix(tmpM);

        // the outer surface its tip should reach
        let Rt = THREE.MathUtils.lerp(0.6, 0.87, THREE.MathUtils.smoothstep(eyeAng, 0.3, 0.95));
        Rt -= 0.07 * THREE.MathUtils.smoothstep(-dir.y, 0.5, 1.0); // a little shorter underneath
        Rt += (random() - 0.5) * THREE.MathUtils.lerp(0.015, 0.05, u);
        if (!isDown) Rt += ch.reach;
        // the contour feathers rooted in the down, a third of the way out: the down fills
        // the coat under them (and is what is left when they have gone), each feather's
        // base hidden in it and under those before it; the hairs a short felt on
        // the skin at the eye's rim, rooted higher outwards, the deeper the more feather
        if (faceish) A.addScaledVector(nrm, THREE.MathUtils.lerp(0.004 + random() * 0.003, (Rt - skin0) * 0.5, u * u));
        else if (!isDown) A.addScaledVector(nrm, (Rt - A.length()) * 0.3);
        // the down: small, domed, packed in layers from the skin up under the contour
        // feathers
        else A.addScaledVector(nrm, (Rt - A.length()) * random() * (0.35 - 0.2 * face));
        const r0 = A.length();
        // its curve: up from the skin (at 55° or so, not standing: laid over the ones
        // before it like tiles), then over along the coat (the tip raised or laid down by
        // its character); the down rising softly, a little ruffled
        const curve = isDown
          ? [1.1 + random() * 0.3, -0.1 + random() * 0.25, 0.4 + random() * 0.1, 0]
          : [0.95 + random() * 0.15, 0.12 + random() * 0.08 + ch.lift * (0.7 + random() * 0.6), 0.3 + random() * 0.08, 0];
        // the hairs: leaning low, straight, like a combed pile (neighbours offset copies of
        // each other rather than crossing at shallow angles), rising into a feather's curve
        if (faceish) {
          const hair = [0.33 + random() * 0.06, 0.27 + random() * 0.06, 0.5];
          for (let c = 0; c < 3; c++) curve[c] = hair[c] + (curve[c] - hair[c]) * u;
        }
        // its length, for the tip to reach Rt (the curve following the coat's roundness)
        let L = 0.5;
        for (let it = 0; it < 3; it++) {
          curve[3] = L / Rt;
          const [sy, sz] = shaftAt(curve, 1);
          // |L s + (0, r0)| = Rt
          const ss = sy * sy + sz * sz, sc = sz * r0;
          L = (-sc + Math.sqrt(Math.max(sc * sc - ss * (r0 * r0 - Rt * Rt), 0))) / ss;
        }
        // (the contour feathers smaller towards the face; round the eyes, from a hair's
        // length at the rim up to theirs)
        const near = THREE.MathUtils.smoothstep(eyeAng, 0.4, 0.8);
        if (!isDown) L = THREE.MathUtils.clamp(L * THREE.MathUtils.lerp(0.4, 1, near), THREE.MathUtils.lerp(0.07, 0.1, near), 0.95);
        if (faceish) L = THREE.MathUtils.lerp(0.045, L, Math.pow(g, 1.3)) * (0.8 + random() * 0.4);
        if (isDown) L = 0.09 + random() * 0.06;
        // none lying over an eye or the beak: shortened to stop at its rim, or left out
        {
          let ok = true;
          for (let it = 0; it < 6; it++) {
            ok = true;
            for (const tt of [0.6, 0.8, 1]) {
              const [sy, sz] = shaftAt(curve, tt);
              vB.copy(A).addScaledVector(flow, sy * L).addScaledVector(nrm, sz * L).normalize();
              for (const e of eyes) if (vB.dot(e) > Math.cos(0.36)) ok = false;
              if (vB.dot(beak) > BEAK_CLEAR) ok = false;
            }
            if (ok) break;
            L *= 0.8;
          }
          if (!ok || L < (faceish ? 0.015 : 0.05)) continue;
        }
        curve[3] = L / Rt;

        T.anchor.set([A.x, A.y, A.z], k * 3);
        // the same feather on the bare body: at the same place of skin, along the same flow
        // (a step along it on the ball, taken to the bare body), shorter where the skin is
        // squeezed (the crown onto the small head)
        {
          const sc = THREE.MathUtils.clamp(Math.sqrt(stretch(dir)), 0.3, 1.1) * (isDown ? 0.85 : 0.7);
          const P1 = vA, N1 = vB, P2 = vC;
          skinAt(dir, 1, P1, N1);
          const d2 = d.copy(dir).multiplyScalar(skin0).addScaledVector(flow, 0.01).normalize();
          skinAt(d2, 1, P2);
          const f1 = P2.sub(P1);
          proj(f1, N1, f1);
          if (f1.lengthSq() < 1e-10) proj(down, N1, f1);
          f1.normalize();
          P1.addScaledVector(N1, (A.length() - skin0) * sc * 0.35);
          T.anchor1.set([P1.x, P1.y, P1.z], k * 3);
          const xx = d.crossVectors(f1, N1);
          tmpM.makeBasis(xx, f1, N1);
          const q1 = new THREE.Quaternion().setFromRotationMatrix(tmpM);
          if (q1.dot(tmpQ) < 0) q1.set(-q1.x, -q1.y, -q1.z, -q1.w);
          T.qLocal1.set([q1.x, q1.y, q1.z, q1.w], k * 4);
          T.scale1[k] = sc;
        }
        T.qLocal.set([tmpQ.x, tmpQ.y, tmpQ.z, tmpQ.w], k * 4);
        // (the hairs widening a little outwards, into feathers)
        const aspect = isDown ? 0.32 + random() * 0.12 : ch.width * THREE.MathUtils.lerp(1.1, 0.75 + 0.25 * near, u) * (0.8 + random() * 0.4);
        const cup = isDown ? 0.25 + random() * 0.15 : ch.cup * (0.75 + random() * 0.5);
        const twist = (random() - 0.5) * (isDown ? 0.6 : 0.3 + 2 * ch.twist) * u;
        T.shape.set([L, aspect, cup, twist], k * 4);
        T.form.set(isDown ? [0.5 + random() * 0.5, 0, 1, 1] : [ch.fray * (0.8 + random() * 0.4), ch.splits * (0.6 + random() * 0.8), ch.sheen, ch.barbs * (0.95 + random() * 0.1)], k * 4);
        T.flow.set(isDown ? [(random() - 0.5) * 0.08, (random() - 0.5) * 0.06, 0, 0.018 + random() * 0.012] : flowOf(ch, sweepAt(dir, x), faceish ? 0.35 + 0.65 * u : 1), k * 4);
        T.curve.set(curve, k * 4);
        // the downy part is the part rising from the skin, under the coat
        const tDown = isDown ? 0 : THREE.MathUtils.lerp(0.04 + 0.08 * g, curve[2] - 0.06 + (random() - 0.5) * 0.04, u);
        T.look.set([random() * 997, isDown ? 1 : 0, tDown, 1], k * 4);
        // the angle the free feather is turned by, to start where it lay
        T.lift[k] = shaftAngle(curve, 0.55) - (isDown ? 0.32 - 0.6 * 0.55 : 0.28 - 0.6 * 0.55);

        // colour: one region's, picked by the weights (a ragged edge between regions), a
        // little noise
        // (round the eyes the face's, the coat's mingling in outwards)
        const wFace = faceish ? 1 - 0.85 * THREE.MathUtils.smoothstep(g, 0.3, 1) : face;
        const wBack = (1 - wFace) * THREE.MathUtils.smoothstep(dir.y * 0.8 - dir.z * 0.9, -0.15, 0.35);
        const wBelly = (1 - wFace) * (1 - wBack) * THREE.MathUtils.smoothstep(-dir.y, 0.35, 0.75);
        const wBreast = Math.max(0, 1 - wFace - wBack - wBelly);
        const ws = [[regions.back, wBack], [regions.face, wFace], [regions.breast, wBreast], [regions.belly, wBelly]];
        // (cubed: a narrower ragged band)
        let pick = random() * ws.reduce((m, [, w]) => m + w ** 3, 0), rg = ws[0][0];
        for (const [r, w] of ws) { rg = r; if ((pick -= w ** 3) <= 0) break; }
        cA.copy(rg.a).getHSL(hsl);
        cA.setHSL(hsl.h + (random() - 0.5) * 0.02, hsl.s * (0.9 + random() * 0.2), hsl.l * (0.88 + random() * 0.24));
        // the hairs a shade darker at the eye's rim, an eye ring
        if (faceish) cA.multiplyScalar(THREE.MathUtils.lerp(0.62, 1, THREE.MathUtils.smoothstep(g, 0.0, 0.2)));
        // the down white, barely tinted by the coat over it
        if (isDown) cA.lerp(white, 0.86 + random() * 0.08);
        T.colA.set([cA.r, cA.g, cA.b], k * 3);
        T.colB.set([rg.b.r, rg.b.g, rg.b.b], k * 3);
        T.colC.set([rg.c.r, rg.c.g, rg.c.b], k * 3);
        T.colD.set([rg.d.r, rg.d.g, rg.d.b], k * 3);
        T.pat.set([THREE.MathUtils.lerp(0.05, 0.12 + random() * 0.1, u), rg.band * (0.7 + random() * 0.6) * u, 0.74 + random() * 0.06, isDown ? 0.5 : ch.tip * (0.8 + random() * 0.4)], k * 4);
        // (the marks appearing as the hairs become feathers)
        T.mark.set([isDown || u < 0.5 ? 0 : rg.mark, rg.density * (0.9 + random() * 0.2), rg.strength * THREE.MathUtils.smoothstep(u, 0.5, 1), rg.grad * (0.8 + random() * 0.4)], k * 4);
        T.sheen.set([isDown ? 0 : rg.iri * (0.8 + random() * 0.4), rg.film * (0.97 + random() * 0.06)], k * 2);

        // how hard it holds: the long ones let go first, the down last; one outer feather
        // in eight barely holds, so the first shake already sends a few flying
        const gr = random();
        const loose = !isDown && u >= 0.5 && gr < 0.12;
        T.grip[k] = isDown || u < 0.5 ? 150 + gr * 120 : loose ? 20 + gr / 0.12 * 30 : 70 + gr * 130 - L * 30;
        T.hold[k] = (0.7 + random() * 0.8) * (loose ? 0.55 : 1);
        // the down soft, slow and swaying more
        T.omega[k] = (isDown ? 11 + random() * 5 : 22 + random() * 16) / Math.sqrt(Math.max(L, 0.2) / 0.5);
        T.zeta[k] = isDown ? 0.12 + random() * 0.08 : 0.18 + random() * 0.15;

        T.area[k] = L * L * aspect;
        k++;
      }
    };
    // the display feathers: a few, long, standing out of the coat at their site, in its
    // shape
    const showy = (site) => {
      const ch = CHARACTERS[looks.display];
      const shName = looks.shapes[site], shape = DISPLAY_SHAPES[shName], shIndex = DISPLAY_SHAPE_NAMES.indexOf(shName);
      const up = new THREE.Vector3(0, 1, 0);
      // per site: the feathers' roots (directions) and the way they lean (a direction
      // their shafts head for, before the curve)
      const roots = []; // + sw: the way its sweep goes (-1 … 1; the tail's fanning out, its middle straight)
      // the curling shapes and the wisp's loose cloud take more room: fewer of them, and
      // all of a site turning the same way on each side (outwards), so they never tangle
      // into each other
      const curling = shName === 'curl' || shName === 'coil' || shName === 'sickle' || shName === 'wisp';
      if (site === 'crest') {
        const m = curling ? 4 + Math.floor(random() * 2) : 5 + Math.floor(random() * 4);
        for (let i = 0; i < m; i++) {
          const u = m > 1 ? i / (m - 1) : 0.5;
          roots.push({ dir: new THREE.Vector3((random() - 0.5) * 0.12, 0.92 - u * 0.1, 0.42 - u * 0.5), lean: new THREE.Vector3((u - 0.5) * 0.6, 1, -0.45 - u * 0.3), L: 0.8 + random() * 0.2 - u * 0.15, sw: ((w) => (curling ? (u === 0.5 ? 1 : Math.sign(u - 0.5)) * Math.max(0.35, Math.abs(w)) : w))((u - 0.5) * 1.6 + (random() - 0.5) * 0.6) });
        }
      } else if (site === 'tail') {
        const m = curling ? 4 + Math.floor(random() * 3) : 5 + Math.floor(random() * 5);
        for (let i = 0; i < m; i++) {
          const u = m > 1 ? i / (m - 1) - 0.5 : 0;
          roots.push({ dir: new THREE.Vector3(u * 0.35, -0.3 + random() * 0.06, -0.95), lean: new THREE.Vector3(u * 1.6, 0.35 + random() * 0.2, -1), L: 1.05 + random() * 0.25 - Math.abs(u) * 0.4, sw: Math.sign(u) * Math.min(1, Math.abs(u) * 2.2) * (0.5 + random() * 0.5) });
        }
      } else if (site === 'brows') {
        const m = 2 + Math.floor(random() * 2);
        for (const e of eyes) {
          const sx = Math.sign(e.x);
          for (let i = 0; i < m; i++)
            roots.push({ dir: e.clone().add(new THREE.Vector3(sx * (0.1 + i * 0.08), 0.62 + i * 0.05, -0.2 - i * 0.08)), lean: new THREE.Vector3(sx * (0.35 + i * 0.2), 1, -0.15 - i * 0.2), L: 0.48 + random() * 0.08 - i * 0.05, sw: sx * (0.6 + random() * 0.4) });
        }
      }
      for (const rt of roots) {
        if (k >= n) break;
        const dir = rt.dir.normalize();
        A.copy(dir).multiplyScalar(1 / Math.sqrt((dir.x / radii.x) ** 2 + (dir.y / radii.y) ** 2 + (dir.z / radii.z) ** 2));
        nrm.set(A.x / radii.x ** 2, A.y / radii.y ** 2, A.z / radii.z ** 2).normalize();
        // rooted halfway out in the coat
        A.addScaledVector(nrm, (0.85 - A.length()) * 0.5);
        // the shaft leaves along the lean: split into its rise from the coat and its way along
        proj(rt.lean.normalize(), nrm, flow);
        if (flow.lengthSq() < 1e-4) proj(up, nrm, flow);
        flow.normalize();
        const rise = Math.acos(THREE.MathUtils.clamp(rt.lean.dot(flow), -1, 1)) * Math.sign(rt.lean.dot(nrm) || 1);
        z.copy(nrm);
        x.crossVectors(flow, z);
        tmpM.makeBasis(x, flow, z);
        tmpQ.setFromRotationMatrix(tmpM);
        const curve = [rise + 0.25 + random() * 0.1, rise - 0.35 - random() * 0.2 + ch.lift * 0.5, 0.75, 0];
        const L = rt.L * ch.length * shape.length * (0.92 + random() * 0.16);
        // its width the shape's, a little more or less by its character
        // (kept within its shape's: a wide character makes them only a little wider)
        const aspect = shape.width * THREE.MathUtils.clamp(Math.sqrt(ch.width / 0.165), 0.85, 1.1) * (0.9 + random() * 0.2);
        // turning round its shaft one way or the other
        const twist = shape.twist * (0.75 + random() * 0.5) * (random() < 0.5 ? -1 : 1);
        T.anchor.set([A.x, A.y, A.z], k * 3);
        T.qLocal.set([tmpQ.x, tmpQ.y, tmpQ.z, tmpQ.w], k * 4);
        T.shape.set([L, aspect, ch.cup * (shName === 'ribbon' ? 0.3 : 0.8 + random() * 0.4), twist], k * 4);
        T.curve.set(curve, k * 4);
        // flowing: a long sweep and S, its vane parting into strands, stirring in the air
        T.flow.set(flowOf(ch, THREE.MathUtils.clamp(rt.sw, -1, 1), 2.4), k * 4);
        // (a curling one keeps its curve clean: hardly an S, its vane barely parting, stirring less)
        if (curling) { T.flow[k * 4 + 1] *= 0.25; T.flow[k * 4 + 2] *= 0.5; T.flow[k * 4 + 3] *= 1.1; }
        else { T.flow[k * 4 + 2] = Math.min(1, T.flow[k * 4 + 2] * 1.25); T.flow[k * 4 + 3] *= 1.8; }
        T.look.set([random() * 997, 2 + shIndex, 0.1 + random() * 0.04, 1], k * 4);
        T.lift[k] = shaftAngle(curve, 0.55) - (0.28 - 0.6 * 0.55);
        T.form.set([ch.fray * (0.8 + random() * 0.4), ch.splits * (0.6 + random() * 0.8), ch.sheen * 1.15, ch.barbs], k * 4);
        const r = regions.display;
        cA.copy(r.a).getHSL(hsl);
        cA.setHSL(hsl.h + (random() - 0.5) * 0.03, hsl.s, hsl.l * (0.9 + random() * 0.2));
        T.colA.set([cA.r, cA.g, cA.b], k * 3);
        T.colB.set([r.b.r, r.b.g, r.b.b], k * 3);
        T.colC.set([r.c.r, r.c.g, r.c.b], k * 3);
        T.colD.set([r.d.r, r.d.g, r.d.b], k * 3);
        T.pat.set([0.2 + random() * 0.1, r.band * (0.8 + random() * 0.4), 0.8 + random() * 0.06, ch.tip * (0.85 + random() * 0.3)], k * 4);
        // the racket always an eye in its vane, the ribbon never
        const grad = r.grad * (0.8 + random() * 0.4);
        T.mark.set(shape.eye ? [4, 1, 1, grad] : shape.plain && r.mark === 4 ? [2, 6, r.strength, grad] : [r.mark, r.density, r.strength, grad], k * 4);
        T.sheen.set([r.iri * (0.8 + random() * 0.4), r.film * (0.97 + random() * 0.06)], k * 2);
        // held fast, swaying slowly
        T.grip[k] = 160 + random() * 80;
        T.hold[k] = 0.8 + random() * 0.5;
        T.omega[k] = (14 + random() * 6) / Math.sqrt(Math.max(L, 0.2) / 0.5);
        T.zeta[k] = 0.12 + random() * 0.08;
        T.area[k] = L * L * aspect * 0.5;
        k++;
      }
    };

    place(nContour, 'contour');
    place(nFace, 'face');
    place(nSmall, 'small');
    for (const site of looks.sites) showy(site);
    place(nDown, 'down');
    this.n = k;
    let total = 0;
    for (let i = 0; i < k; i++) total += T.area[i];
    this.totalArea = total;
  }

  // ---- instances -------------------------------------------------------------------
  alloc() {
    const m = this.max;
    this.s = {
      tpl: new Int32Array(m).fill(-1), mode: new Uint8Array(m), grow: new Float32Array(m), delay: new Float32Array(m),
      dmg: new Float32Array(m), bend: new Float32Array(m * 3), bendV: new Float32Array(m * 3),
      c: new Float32Array(m * 3), v: new Float32Array(m * 3), w: new Float32Array(m * 3), age: new Float32Array(m),
      spin: new Float32Array(m),
      // flung off by a poof: the time since, and how long it lasts
      away: new Float32Array(m), life: new Float32Array(m),
      // left ruffled by a stroke: across, and standing up
      ruf: new Float32Array(m * 2),
    };
    this.holder = new Int32Array(this.n).fill(-1); // template → its attached slot
  }

  // put template t in slot i, attached, grown by `grow`
  assign(i, t, grow, delay = 0) {
    const s = this.s, T = this.tpl, a = this.feathers.arrays;
    s.tpl[i] = t;
    s.mode[i] = 1;
    s.grow[i] = grow;
    s.delay[i] = delay;
    s.dmg[i] = 0;
    s.away[i] = 0;
    s.bend.fill(0, i * 3, i * 3 + 3);
    s.bendV.fill(0, i * 3, i * 3 + 3);
    s.ruf[i * 2] = s.ruf[i * 2 + 1] = 0;
    a.iShape.set(T.shape.subarray(t * 4, t * 4 + 4), i * 4);
    a.iShape[i * 4] *= 1 + (T.scale1[t] - 1) * this.creature.morph;
    a.iCurve.set(T.curve.subarray(t * 4, t * 4 + 4), i * 4);
    a.iLook.set(T.look.subarray(t * 4, t * 4 + 4), i * 4);
    a.iPat.set(T.pat.subarray(t * 4, t * 4 + 4), i * 4);
    a.iForm.set(T.form.subarray(t * 4, t * 4 + 4), i * 4);
    a.iColA.set(T.colA.subarray(t * 3, t * 3 + 3), i * 4);
    a.iColB.set(T.colB.subarray(t * 3, t * 3 + 3), i * 4);
    a.iColC.set(T.colC.subarray(t * 3, t * 3 + 3), i * 4);
    a.iColD.set(T.colD.subarray(t * 3, t * 3 + 3), i * 4);
    // (the movement and the sheen ride in their w)
    setFlow(a, i, T.flow.subarray(t * 4, t * 4 + 4), T.sheen[t * 2], T.sheen[t * 2 + 1]);
    a.iMark.set(T.mark.subarray(t * 4, t * 4 + 4), i * 4);
    this.holder[t] = i;
  }

  // how much of the coat is left, by area (0 … 1)
  coverage() {
    const s = this.s, T = this.tpl;
    let a = 0;
    for (let t = 0; t < this.n; t++) {
      const i = this.holder[t];
      if (i >= 0) a += T.area[t] * Math.min(1, s.grow[i]);
    }
    return a / this.totalArea;
  }

  attachedCount() {
    let c = 0;
    for (let t = 0; t < this.n; t++) if (this.holder[t] >= 0) c++;
    return c;
  }

  // the feathers back on the body, one after another over `spread` s, from `after` s on,
  // each taking `dur` s to grow (0: there at once, full size, no growing)
  regrow(spread = 0, after = 0, dur = 0) {
    this.growDur = dur;
    const missing = [];
    for (let t = 0; t < this.n; t++) if (this.holder[t] < 0) missing.push(t);
    this.pending = missing.length ? missing.map((t) => ({ t, delay: after + this.random() * spread })) : null;
  }

  // POOF: the feathers off the body (and for a molt those on it too) gone at once, but
  // `fly` of them flung off, spinning and dwindling
  poof({ fly = 26, molt = false } = {}) {
    const s = this.s, a = this.feathers.arrays;
    if (molt) {
      this.pending = null;
      for (let t = 0; t < this.n; t++) if (this.holder[t] >= 0) this.release(this.holder[t], 0.5);
    }
    const off = [];
    for (let i = 0; i < this.max; i++) if (s.mode[i] >= 2) off.push(i);
    // the few that fly: contour feathers rather than down, wherever they lie
    const pick = [];
    for (let k = 0; k < off.length * 4 && pick.length < fly; k++) {
      const i = off[Math.floor(this.random() * off.length)];
      if (s.mode[i] === 5 || pick.includes(i) || (Math.abs(a.iLook[i * 4 + 1] - 1) < 0.5 && this.random() < 0.8)) continue;
      pick.push(i);
    }
    for (const i of off) {
      if (pick.includes(i)) continue;
      s.mode[i] = 0; s.tpl[i] = -1; s.away[i] = 0; a.iBend[i * 4 + 3] = 0;
    }
    const cr = this.creature;
    for (const i of pick) {
      // up and away from the bird
      const i3 = i * 3;
      const dx = s.c[i3] - cr.pos.x, dz = s.c[i3 + 2] - cr.pos.z;
      const d = Math.max(Math.hypot(dx, dz), 0.2);
      const sp = 2 + this.random() * 3;
      this.fling(i, (dx / d) * sp, 4.5 + this.random() * 4, (dz / d) * sp, 0.6 + this.random() * 0.6);
    }
  }

  // a puff out of the coat: `n` down feathers and `nc` small contour feathers bursting
  // out of the skin (from where theirs grow), dwindling in a moment
  puff(n = 260, nc = 18) {
    const s = this.s, a = this.feathers.arrays, T = this.tpl, cr = this.creature;
    const mo = cr.morph, P = new THREE.Vector3(), Q = new THREE.Quaternion(), Ql = new THREE.Quaternion();
    let slot = 0;
    for (let k = 0; k < n + nc; k++) {
      const down = k < n;
      let t = -1;
      for (let tries = 0; tries < 20 && t < 0; tries++) {
        // (the contour feathers come first in the layout)
        const c = Math.floor(this.random() * (down ? this.n : this.nContour));
        if ((Math.abs(T.look[c * 4 + 1] - 1) < 0.5) === down) t = c;
      }
      if (t < 0) continue;
      while (slot < this.max && s.mode[slot] !== 0) slot++;
      if (slot >= this.max) return;
      const i = slot, held = this.holder[t];
      this.assign(i, t, 1);
      this.holder[t] = held;
      // where it grows on the body as it is now, turned as it lies
      const t3 = t * 3, t4 = t * 4;
      P.set(T.anchor[t3] + (T.anchor1[t3] - T.anchor[t3]) * mo, T.anchor[t3 + 1] + (T.anchor1[t3 + 1] - T.anchor[t3 + 1]) * mo,
        T.anchor[t3 + 2] + (T.anchor1[t3 + 2] - T.anchor[t3 + 2]) * mo).multiply(cr.scale);
      const out = P.clone().normalize();
      P.applyQuaternion(cr.quat).add(cr.pos);
      out.applyQuaternion(cr.quat);
      Ql.set(T.qLocal[t4], T.qLocal[t4 + 1], T.qLocal[t4 + 2], T.qLocal[t4 + 3]);
      Q.copy(cr.quat).multiply(Ql);
      a.iQuat.set([Q.x, Q.y, Q.z, Q.w], i * 4);
      a.iPos.set([P.x, P.y, P.z], i * 3);
      s.c.set([P.x, P.y, P.z], i * 3);
      s.tpl[i] = t;
      const sp = down ? 1.8 + this.random() * 2.2 : 1.5 + this.random() * 2;
      this.fling(i, cr.vel.x + out.x * sp, cr.vel.y + out.y * sp + 0.6, cr.vel.z + out.z * sp, down ? 0.35 + this.random() * 0.45 : 0.7 + this.random() * 0.6);
    }
    this.staticDirty = true;
  }

  // off the body, flung at (vx, vy, vz), gone after `life` s
  fling(i, vx, vy, vz, life) {
    const s = this.s, a = this.feathers.arrays;
    s.mode[i] = 5;
    s.away[i] = 0;
    s.life[i] = life;
    s.grow[i] = 1;
    s.age[i] = 0;
    s.v[i * 3] = vx; s.v[i * 3 + 1] = vy; s.v[i * 3 + 2] = vz;
    for (let k = 0; k < 3; k++) s.w[i * 3 + k] = (this.random() - 0.5) * 18;
    s.spin[i] = (this.random() - 0.5) * 4;
    a.iBend[i * 4 + 3] = 1;
    a.iLook[i * 4 + 3] = 0.999;
  }

  // nothing left: on the body, in the air or on the floor
  empty() {
    const s = this.s;
    if (this.pending) return false;
    for (let i = 0; i < this.max; i++) if (s.mode[i] !== 0) return false;
    return true;
  }

  // waiting to grow back, or some still on their way off
  recovering() {
    const s = this.s;
    if (this.pending) return true;
    for (let i = 0; i < this.max; i++) if (s.mode[i] === 5) return true;
    return false;
  }

  // let a feather go, now (with an extra kick)
  release(i, kick = 1) {
    const s = this.s, cr = this.creature, a = this.feathers.arrays;
    const t = s.tpl[i];
    this.holder[t] = -1;
    s.mode[i] = 2;
    s.age[i] = 0;
    s.away[i] = 0;
    const L = a.iShape[i * 4];
    // turned to lie as it did, its curve relaxing as it flies (iLook.w fading)
    tmpQ.set(a.iQuat[i * 4], a.iQuat[i * 4 + 1], a.iQuat[i * 4 + 2], a.iQuat[i * 4 + 3]);
    tmpQ.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), this.tpl.lift[t]));
    a.iQuat.set([tmpQ.x, tmpQ.y, tmpQ.z, tmpQ.w], i * 4);
    const qx = tmpQ.x, qy = tmpQ.y, qz = tmpQ.z, qw = tmpQ.w;
    qrot(qx, qy, qz, qw, 0, 1, 0, R, 0);
    for (let k = 0; k < 3; k++) s.c[i * 3 + k] = a.iPos[i * 3 + k] + R[k] * L * 0.4;
    // the body's velocity at that point, and a flick outwards
    const out = vA.set(s.c[i * 3] - cr.pos.x, s.c[i * 3 + 1] - cr.pos.y, s.c[i * 3 + 2] - cr.pos.z).normalize();
    const flick = (0.6 + this.random() * 1.6) * kick;
    s.v[i * 3] = cr.vel.x + out.x * flick + (this.random() - 0.5) * 0.6;
    s.v[i * 3 + 1] = cr.vel.y + out.y * flick + this.random() * 0.8;
    s.v[i * 3 + 2] = cr.vel.z + out.z * flick + (this.random() - 0.5) * 0.6;
    s.w[i * 3] = (this.random() - 0.5) * 8;
    s.w[i * 3 + 1] = (this.random() - 0.5) * 8;
    s.w[i * 3 + 2] = (this.random() - 0.5) * 8;
    s.spin[i] = (this.random() - 0.5) * 2.5;
    a.iLook[i * 4 + 3] = 0.999;
  }

  // drop a share of the coat at once (the address's &shed=)
  shed(frac) {
    for (let t = 0; t < this.n; t++) {
      const i = this.holder[t];
      if (i >= 0 && this.random() < frac) this.release(i, 2.5);
    }
  }

  // the pointer over the coat, its `ray` (null: not over it, or holding it): where it
  // meets the coat's outer surface, and how it moves over it
  stroke(ray, dt) {
    const cr = this.creature, tc = this.touch;
    let want = 0;
    if (ray && cr.coverage > 0.02) {
      const R = cr.radius;
      const oc = vA.copy(cr.pos).sub(ray.origin);
      const along = oc.dot(ray.direction);
      const close = vB.copy(ray.origin).addScaledVector(ray.direction, along).sub(cr.pos);
      const d = close.length();
      if (along > 0 && d < R * 1.25) {
        // on the sphere's near side, or just off its rim: the rim
        const p = d < R
          ? vC.copy(ray.origin).addScaledVector(ray.direction, along - Math.sqrt(R * R - d * d))
          : vC.copy(cr.pos).addScaledVector(close, R / Math.max(d, 1e-4));
        want = 1 - THREE.MathUtils.smoothstep(d, R * 0.95, R * 1.25);
        if (!tc.last) tc.last = p.clone();
        // its speed over the coat, the body's own motion taken off
        const v = vB.copy(p).sub(tc.last).divideScalar(Math.max(dt, 1e-3)).sub(cr.vel);
        tc.v.lerp(v.clampLength(0, 8), 1 - Math.exp(-dt * 25));
        tc.last.copy(p);
        tc.p.copy(p);
      } else tc.last = null;
    } else tc.last = null;
    if (!tc.last) tc.v.multiplyScalar(Math.exp(-dt * 10));
    tc.on += (want - tc.on) * (1 - Math.exp(-dt * (want > tc.on ? 14 : 6)));
    tc.rub = tc.on * THREE.MathUtils.smoothstep(tc.v.length(), 0.3, 3) * Math.pow(cr.coverage, 0.8);
  }

  // the air's velocity at p (body passing, pointer sweeping, a faint draught)
  airAt(x, y, z, out) {
    const cr = this.creature;
    out[0] = Math.sin(this.time * 0.31 + y * 1.3) * 0.05;
    out[1] = 0;
    out[2] = Math.cos(this.time * 0.23 + x * 1.1) * 0.05;
    const dx = x - cr.pos.x, dy = y - cr.pos.y, dz = z - cr.pos.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const R0 = cr.radius;
    const f = Math.exp(-Math.max(dist - R0, 0) / 0.45) * 0.85;
    out[0] += cr.vel.x * f; out[1] += cr.vel.y * f; out[2] += cr.vel.z * f;
    // the body's legs fanning it on landing, and its wings it doesn't have: nothing more
    const p = this.wind.pointer;
    if (p && p.speed > 0) {
      // closest point on the pointer's ray
      const ox = x - p.origin.x, oy = y - p.origin.y, oz = z - p.origin.z;
      const along = ox * p.dir.x + oy * p.dir.y + oz * p.dir.z;
      if (along > 0) {
        const px = ox - p.dir.x * along, py = oy - p.dir.y * along, pz = oz - p.dir.z * along;
        const r2 = px * px + py * py + pz * pz;
        const g = Math.exp(-r2 / (0.35 * 0.35)) * 0.9;
        out[0] += p.vel.x * along * g; out[1] += p.vel.y * along * g; out[2] += p.vel.z * along * g;
      }
    }
  }

  update(dt) {
    this.time += dt;
    const cr = this.creature;
    const s = this.s, T = this.tpl, a = this.feathers.arrays;
    const { pos, quat, scale } = cr;
    const bq = [quat.x, quat.y, quat.z, quat.w];
    // what the feathers feel: gravity minus the body's acceleration, and the shaking
    const Fx = -cr.acc.x, Fy = -cr.acc.y - cr.gravity, Fz = -cr.acc.z;
    const shake = cr.shake;
    const ruffle = cr.ruffle;
    const spin = cr.spinAcc * 0.9;
    const air = R;
    // the body's shape (0 ball … 1 bare)
    const mo = cr.morph;
    const reshaped = Math.abs(mo - (this.lastMorph ?? 0)) > 1e-4 || this.staticDirty;
    this.lastMorph = mo;
    const air2 = new Float32Array(3);
    // the stroke (see stroke())
    const tc = this.touch, touching = tc.on > 0.01;
    const tpx = tc.p.x, tpy = tc.p.y, tpz = tc.p.z, tvx = tc.v.x, tvy = tc.v.y, tvz = tc.v.z;
    const tr2 = 1 / (tc.r * tc.r);
    // (measured across the coat: the feathers' middles lie deeper than its surface)
    const tn = vA.copy(tc.p).sub(pos).normalize(), tnx = tn.x, tny = tn.y, tnz = tn.z;
    const rufDecay = Math.exp(-dt / 2.2);

    // feathers waiting to grow back
    if (this.pending) {
      let free = 0;
      for (const p of this.pending) {
        if (p.done) continue;
        p.delay -= dt;
        if (p.delay > 0 || this.holder[p.t] >= 0) {
          if (this.holder[p.t] >= 0) p.done = true;
          continue;
        }
        while (free < this.max && s.mode[free] !== 0) free++;
        if (free >= this.max) break;
        this.assign(free, p.t, this.growDur > 0 ? 0.001 : 1);
        this.staticDirty = true;
        p.done = true;
      }
      if (this.pending.every((p) => p.done)) this.pending = null;
    }

    for (let i = 0; i < this.max; i++) {
      const mode = s.mode[i];
      if (mode === 0) continue;
      const t = s.tpl[i];
      const i3 = i * 3, i4 = i * 4;
      const L = a.iShape[i4];

      if (mode === 1) {
        // ---- on the body
        if (s.grow[i] < 1) s.grow[i] = this.growDur > 0 ? Math.min(1, s.grow[i] + dt / this.growDur) : 1;
        // world pose: on the body as it is shaped now, its squash, turn and place
        const t3 = t * 3, t4 = t * 4;
        const ax = (T.anchor[t3] + (T.anchor1[t3] - T.anchor[t3]) * mo) * scale.x;
        const ay = (T.anchor[t3 + 1] + (T.anchor1[t3 + 1] - T.anchor[t3 + 1]) * mo) * scale.y;
        const az = (T.anchor[t3 + 2] + (T.anchor1[t3 + 2] - T.anchor[t3 + 2]) * mo) * scale.z;
        qrot(bq[0], bq[1], bq[2], bq[3], ax, ay, az, a.iPos, i3);
        a.iPos[i3] += pos.x; a.iPos[i3 + 1] += pos.y; a.iPos[i3 + 2] += pos.z;
        let lx = T.qLocal[t4], ly = T.qLocal[t4 + 1], lz = T.qLocal[t4 + 2], lw = T.qLocal[t4 + 3];
        if (mo !== 0) {
          lx += (T.qLocal1[t4] - lx) * mo; ly += (T.qLocal1[t4 + 1] - ly) * mo;
          lz += (T.qLocal1[t4 + 2] - lz) * mo; lw += (T.qLocal1[t4 + 3] - lw) * mo;
          const ql = 1 / Math.sqrt(lx * lx + ly * ly + lz * lz + lw * lw);
          lx *= ql; ly *= ql; lz *= ql; lw *= ql;
        }
        if (reshaped) a.iShape[i4] = T.shape[t4] * (1 + (T.scale1[t] - 1) * mo);
        const qx = bq[3] * lx + bq[0] * lw + bq[1] * lz - bq[2] * ly;
        const qy = bq[3] * ly - bq[0] * lz + bq[1] * lw + bq[2] * lx;
        const qz = bq[3] * lz + bq[0] * ly - bq[1] * lx + bq[2] * lw;
        const qw = bq[3] * lw - bq[0] * lx - bq[1] * ly - bq[2] * lz;
        a.iQuat[i4] = qx; a.iQuat[i4 + 1] = qy; a.iQuat[i4 + 2] = qz; a.iQuat[i4 + 3] = qw;
        // the force in the feather's frame (inverse rotation)
        // and the twist's inertia (a rouse whipping the body about UP): −α × r, r the anchor
        const rx = a.iPos[i3] - pos.x, rz = a.iPos[i3 + 2] - pos.z;
        qrot(-qx, -qy, -qz, qw, Fx - spin * rz, Fy, Fz + spin * rx, air2, 0);
        const om = T.omega[t], ze = T.zeta[t];
        const gain = 0.0022 * (0.6 + L);
        const loose = s.dmg[i];
        // ruffled, the coat stands up, in waves: each feather lifting and dropping on its
        // own beat, a ripple running down the body from the head
        const flut = 0.55 + 0.45 * Math.sin(this.time * (22 + (t % 11) * 1.3) - ay * 14 + t * 2.39);
        let restZ = loose * 0.1 + ruffle * (0.04 + 0.1 * flut) * T.hold[t];
        let restX = loose * 0.06 * (T.hold[t] - 1.1);
        // stroked: the pointer at the feather's middle, its motion in the feather's frame
        // (y along the shaft to the tip, z out of the coat)
        const r2 = i * 2;
        if (touching) {
          qrot(qx, qy, qz, qw, 0, 1, 0, air2, 0);
          const mx = a.iPos[i3] + air2[0] * L * 0.5 - tpx, my = a.iPos[i3 + 1] + air2[1] * L * 0.5 - tpy, mz = a.iPos[i3 + 2] + air2[2] * L * 0.5 - tpz;
          const depth = mx * tnx + my * tny + mz * tnz;
          const g = depth < -0.5 ? 0 : Math.exp(-(mx * mx + my * my + mz * mz - depth * depth) * tr2) * tc.on;
          if (g > 0.01) {
            qrot(-qx, -qy, -qz, qw, tvx, tvy, tvz, air2, 0);
            const sx = air2[0], sy = air2[1];
            qrot(-qx, -qy, -qz, qw, mx, my, mz, air2, 0);
            // parted round the fingertip, pressed in a little
            const part = air2[0] / tc.r;
            const against = Math.max(-sy, 0), along = Math.max(sy, 0);
            restX += g * (part * 0.2 + Math.max(-0.25, Math.min(0.25, sx * 0.07)));
            restZ += g * (Math.min(against * 0.11, 0.3) - Math.min(along * 0.03, 0.08) - 0.05);
            // left ruffled against the grain, combed flat with it
            s.ruf[r2] += g * sx * 0.05 * dt * 6;
            s.ruf[r2 + 1] += g * (against * 0.06 - along * 0.08) * dt * 6;
            // a rough stroke picks out a loose one
            if (against > 2 && s.dmg[i] > 0.3) s.dmg[i] += (against - 2) * g * dt * 0.6 / T.hold[t];
          }
        }
        if (s.ruf[r2] !== 0 || s.ruf[r2 + 1] !== 0) {
          s.ruf[r2] = Math.max(-0.12, Math.min(0.12, s.ruf[r2])) * rufDecay;
          s.ruf[r2 + 1] = Math.max(0, Math.min(0.22, s.ruf[r2 + 1])) * rufDecay;
          if (Math.abs(s.ruf[r2]) + s.ruf[r2 + 1] < 1e-4) s.ruf[r2] = s.ruf[r2 + 1] = 0;
          restX += s.ruf[r2];
          restZ += s.ruf[r2 + 1];
        }
        for (let k = 0; k < 3; k += 2) {
          const target = (k === 0 ? restX : restZ) + air2[k] * gain;
          const b = s.bend[i3 + k], bv = s.bendV[i3 + k];
          // stepped implicitly: stable however stiff the spring or long the frame (a
          // plain step overshoots past ω·dt = 2, the short stiff feathers' bend then
          // flipping from side to side every frame: blinking)
          const nv = (bv + om * om * (target - b) * dt) / (1 + 2 * ze * om * dt + om * om * dt * dt);
          s.bendV[i3 + k] = nv;
          s.bend[i3 + k] = Math.max(-0.5, Math.min(0.5, b + nv * dt));
        }
        a.iBend[i4] = s.bend[i3];
        a.iBend[i4 + 1] = 0;
        a.iBend[i4 + 2] = s.bend[i3 + 2];
        a.iBend[i4 + 3] = s.grow[i];

        // wearing loose
        // the barer the skin, the looser what is left
        // and while the coat is still whole it comes loose quicker: the first feathers go
        // at the first shake, not after a long one
        const over = shake - T.grip[t] * (0.45 + 0.55 * Math.min(1, cr.coverage * 2.5));
        const eager = 1 + 1.8 * THREE.MathUtils.smoothstep(cr.coverage, 0.8, 0.97);
        if (over > 0) s.dmg[i] += over * dt * 0.0042 * eager / T.hold[t];
        else s.dmg[i] = Math.max(0, s.dmg[i] - dt * 0.02);
        if (s.dmg[i] >= 1 && s.grow[i] > 0.5) this.release(i, 1);
        continue;
      }

      // ---- free
      s.age[i] += dt;
      a.iLook[i4 + 3] *= Math.exp(-dt * 5);
      if (mode === 4) {
        // fading away to make room
        s.grow[i] -= dt / 0.5;
        a.iBend[i4 + 3] = Math.max(0, s.grow[i]);
        if (s.grow[i] <= 0) { s.mode[i] = 0; s.tpl[i] = -1; a.iBend[i4 + 3] = 0; }
        continue;
      }
      const isDown = Math.abs(a.iLook[i4 + 1] - 1) < 0.5;
      const cx = s.c[i3], cy = s.c[i3 + 1], cz = s.c[i3 + 2];
      this.airAt(cx, cy, cz, air);
      let qx = a.iQuat[i4], qy = a.iQuat[i4 + 1], qz = a.iQuat[i4 + 2], qw = a.iQuat[i4 + 3];
      const leaving = s.mode[i] === 5;

      if (leaving) {
        // flung off by a poof: flying out, spinning, dwindling, gone
        const u = (s.away[i] += dt);
        const life = s.life[i];
        s.grow[i] = 1 - smooth(life * 0.35, life, u);
        a.iBend[i4 + 3] = Math.max(0, s.grow[i]);
        if (u >= life) {
          s.mode[i] = 0; s.tpl[i] = -1; s.away[i] = 0; a.iBend[i4 + 3] = 0;
          continue;
        }
      } else if (mode === 3) {
        // lying: a gust lifts it again
        const gust = Math.hypot(air[0], air[1], air[2]);
        if (gust < 0.9) continue;
        s.mode[i] = 2;
        s.v[i3] += air[0] * 0.4; s.v[i3 + 1] += gust * 0.5; s.v[i3 + 2] += air[2] * 0.4;
        s.w[i3] += (this.random() - 0.5) * 6; s.w[i3 + 2] += (this.random() - 0.5) * 6;
      }

      // its axes
      qrot(qx, qy, qz, qw, 0, 0, 1, air2, 0);
      const Zx = air2[0], Zy = air2[1], Zz = air2[2];
      qrot(qx, qy, qz, qw, 0, 1, 0, air2, 0);
      const Yx = air2[0], Yy = air2[1], Yz = air2[2];
      qrot(qx, qy, qz, qw, 1, 0, 0, air2, 0);
      const Xx = air2[0], Xy = air2[1], Xz = air2[2];

      let vx = s.v[i3], vy = s.v[i3 + 1], vz = s.v[i3 + 2];
      const ux = vx - air[0], uy = vy - air[1], uz = vz - air[2];
      const un = ux * Zx + uy * Zy + uz * Zz;
      const us = Math.sqrt(ux * ux + uy * uy + uz * uz);
      // (flung by a poof: flying free at first, then fluttering)
      const kd = leaving ? 0.08 + 0.92 * smooth(0.1, 0.6, s.away[i]) : 1;
      const kn = (isDown ? 34 : 15 + 4 / Math.max(L, 0.2)) * kd;
      const kt = (isDown ? 6 : 1.4) * kd;
      const fn = -(kn * un + 6 * kd * un * Math.abs(un));
      vx += (fn * Zx - kt * (ux - un * Zx)) * dt;
      vy += (fn * Zy - kt * (uy - un * Zy) - cr.gravity * (leaving ? 0.12 + 0.15 * kd : 1)) * dt;
      vz += (fn * Zz - kt * (uz - un * Zz)) * dt;

      // turning: broadside to the air, the tip trailing, a spin, a wobble
      let wx = s.w[i3], wy = s.w[i3 + 1], wz = s.w[i3 + 2];
      if (us > 1e-3) {
        const sg = un >= 0 ? 1 : -1;
        const hx = ux / us, hy = uy / us, hz = uz / us;
        const ka = (isDown ? 6 : 14) * Math.min(us, 4);
        // Z·sg → û
        wx += ka * sg * (Zy * hz - Zz * hy) * dt;
        wy += ka * sg * (Zz * hx - Zx * hz) * dt;
        wz += ka * sg * (Zx * hy - Zy * hx) * dt;
        // Y → −û (tip trailing)
        const kp = (isDown ? 2 : 5) * Math.min(us, 4);
        wx -= kp * (Yy * hz - Yz * hy) * dt;
        wy -= kp * (Yz * hx - Yx * hz) * dt;
        wz -= kp * (Yx * hy - Yy * hx) * dt;
        // spinning about its face, faster as it falls
        const sp = s.spin[i] * Math.abs(un) * 3;
        wx += Zx * sp * dt; wy += Zy * sp * dt; wz += Zz * sp * dt;
      }
      const wob = Math.sin(this.time * (5 + (t % 7)) + t) * 3 * dt;
      wx += Xx * wob; wy += Xy * wob; wz += Xz * wob;
      const damp = Math.exp(-(isDown ? 4.5 : 2.6) * dt);
      wx *= damp; wy *= damp; wz *= damp;

      // the body: pushed out of it, carried along
      {
        const dx = cx - pos.x, dy = cy - pos.y, dz = cz - pos.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const R0 = cr.radius * 0.9;
        if (dist < R0 && dist > 1e-4) {
          const k = (R0 - dist) / dist;
          s.c[i3] += dx * k; s.c[i3 + 1] += dy * k; s.c[i3 + 2] += dz * k;
          const nvr = (vx - cr.vel.x) * dx / dist + (vy - cr.vel.y) * dy / dist + (vz - cr.vel.z) * dz / dist;
          if (nvr < 0) { vx -= nvr * dx / dist * 1.3; vy -= nvr * dy / dist * 1.3; vz -= nvr * dz / dist * 1.3; }
        }
      }

      s.c[i3] += vx * dt; s.c[i3 + 1] += vy * dt; s.c[i3 + 2] += vz * dt;

      // the floor
      const half = Math.abs(Yy) * 0.5 * L + Math.abs(Xy) * 0.2 * L + Math.abs(Zy) * 0.03 * L + 0.004;
      let resting = false;
      if (s.c[i3 + 1] < half) {
        s.c[i3 + 1] = half;
        if (vy < 0) vy *= -0.05;
        const fr = Math.exp(-7 * dt);
        vx *= fr; vz *= fr;
        const wd = Math.exp(-6 * dt);
        wx *= wd; wy *= wd; wz *= wd;
        // settling flat, on whichever face is nearest
        const sg = Zy >= 0 ? 1 : -1;
        wx += 12 * sg * (Zy * 0 - Zz * 1) * dt;
        wz += 12 * sg * (Zx * 1 - Zy * 0) * dt;
        if (vx * vx + vy * vy + vz * vz < 0.002 && wx * wx + wy * wy + wz * wz < 0.05 && Math.abs(Zy) > 0.97) resting = true;
      }
      // fell too far out of sight: gone for good
      if (Math.abs(s.c[i3]) > 30 || Math.abs(s.c[i3 + 2]) > 30) { s.mode[i] = 4; s.grow[i] = 0.2; s.away[i] = 0; }

      s.v[i3] = vx; s.v[i3 + 1] = vy; s.v[i3 + 2] = vz;
      s.w[i3] = wx; s.w[i3 + 1] = wy; s.w[i3 + 2] = wz;
      // integrate the turn
      const hx = 0.5 * dt * wx, hy = 0.5 * dt * wy, hz = 0.5 * dt * wz;
      let nx = qx + (hx * qw + hy * qz - hz * qy);
      let ny = qy + (hy * qw + hz * qx - hx * qz);
      let nz = qz + (hz * qw + hx * qy - hy * qx);
      let nw = qw - (hx * qx + hy * qy + hz * qz);
      const ql = 1 / Math.sqrt(nx * nx + ny * ny + nz * nz + nw * nw);
      qx = nx * ql; qy = ny * ql; qz = nz * ql; qw = nw * ql;
      a.iQuat[i4] = qx; a.iQuat[i4 + 1] = qy; a.iQuat[i4 + 2] = qz; a.iQuat[i4 + 3] = qw;
      qrot(qx, qy, qz, qw, 0, 1, 0, air2, 0);
      a.iPos[i3] = s.c[i3] - air2[0] * L * 0.4;
      a.iPos[i3 + 1] = s.c[i3 + 1] - air2[1] * L * 0.4;
      a.iPos[i3 + 2] = s.c[i3 + 2] - air2[2] * L * 0.4;
      // bent by the air on its face, fluttering; flat on the floor
      const onFloor = s.c[i3 + 1] <= half + 1e-3;
      const target = onFloor ? 0 : Math.max(-0.3, Math.min(0.3, -un * 0.05));
      s.bend[i3 + 2] += (target - s.bend[i3 + 2]) * Math.min(1, dt * 8);
      a.iBend[i4] = s.bend[i3] *= Math.exp(-dt * 2);
      a.iBend[i4 + 2] = s.bend[i3 + 2] + (onFloor ? 0 : Math.sin(this.time * 11 + t) * 0.03 * Math.min(us, 2));
      if (resting && !leaving) s.mode[i] = 3;
    }

    this.feathers.touch('iPos', 'iQuat', 'iBend', 'iLook', ...(reshaped ? ['iShape'] : []), ...(this.staticDirty ? STATIC : []));
    this.staticDirty = false;
  }
}
