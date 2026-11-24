// The bolt, held at the instant it touches the ground. Its main channel is a fractal path
// (each stretch broken in two, the middle pushed aside, and again, finer and finer) from
// deep in the cloud down to the strike; off it the branches the leader left, which never
// reached the ground, branching again and fading to their tips; under the cloud's base a
// few crawlers spreading sideways in it; and on the ground, round the strike, the short
// faint streamers that rose to meet it.
// Each channel is drawn twice, as ribbons turned toward the eye: a hair-thin white-hot core
// and a wide violet halo round it (the bloom after the render adds the glare).
import * as THREE from 'three';
import { rng } from './common.js';

// a fractal path from a to b: `levels` halvings, each middle pushed aside by `rough` of
// its stretch's length (less on the finer levels), the push kept mostly horizontal so the
// channel zigzags as it comes down
function fractalPath(rand, a, b, levels, rough, kink = 0.5) {
  let pts = [a.clone(), b.clone()];
  let r = rough;
  for (let l = 0; l < levels; l++) {
    const next = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const p = pts[i], q = pts[i + 1];
      const len = p.distanceTo(q);
      const m = p.clone().lerp(q, 0.35 + rand() * 0.3);
      const off = new THREE.Vector3(rand() - 0.5, (rand() - 0.5) * kink, rand() - 0.5).multiplyScalar(2 * len * r);
      m.add(off);
      next.push(m, q);
    }
    pts = next;
    r *= 0.82;
  }
  return pts;
}

// `out`'s points spread evenly along the path `pts`
function resample(pts, out) {
  const lens = [0];
  for (let i = 1; i < pts.length; i++) lens.push(lens[i - 1] + pts[i].distanceTo(pts[i - 1]));
  const L = lens[lens.length - 1];
  let j = 0;
  for (let s = 0; s < out.length; s++) {
    const d = (s / (out.length - 1)) * L;
    while (j < pts.length - 2 && lens[j + 1] < d) j++;
    const f = (d - lens[j]) / Math.max(1e-6, lens[j + 1] - lens[j]);
    out[s].copy(pts[j]).lerp(pts[j + 1], Math.min(1, f));
  }
}

// the length of the path `pts`, and its first `L` of it
function pathLength(pts) {
  let L = 0;
  for (let i = 1; i < pts.length; i++) L += pts[i].distanceTo(pts[i - 1]);
  return L;
}
function pathPrefix(pts, L) {
  const out = [pts[0]];
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const seg = pts[i].distanceTo(pts[i - 1]);
    if (acc + seg >= L) {
      out.push(pts[i - 1].clone().lerp(pts[i], (L - acc) / Math.max(1e-6, seg)));
      return out;
    }
    acc += seg;
    out.push(pts[i]);
  }
  return out;
}

// the channels of one bolt from `top` to `strike`, the ribbon geometry drawing them, and
// its main channel resampled evenly
function buildBolt(rand, { top, strike, ground, cloudBase, via }) {
  const channels = []; // { pts, width, power } — power along the path in `pow` (0..1)

  // ---- the main channel: from the cloud down to the strike ----
  // (through `via` if given: where an earlier shape came out of the cloud, kept)
  const main = via
    ? [...fractalPath(rand, top, via, 8, 0.26, 0.15).slice(0, -1), ...fractalPath(rand, via, strike, 8, 0.26, 0.15)]
    : fractalPath(rand, top, strike, 9, 0.26, 0.15);
  // a little extra wander on the large scale: the channel leans one way, then another
  const mainCh = { pts: main, width: 0.0065, power: main.map(() => 1), kind: 0 };
  channels.push(mainCh);
  // (each channel off another knows where it grows from, `parent.pts[at]`, to follow it
  // when the main channel moves)

  // ---- the branches: dead-end leaders, more of them up high and a couple of long ones low ----
  const branch = (parent, at, dir, len, width, power, depth) => {
    const from = parent.pts[at];
    const end = from.clone().addScaledVector(dir, len);
    const pts = fractalPath(rand, from, end, Math.max(4, 8 - depth), 0.26, 0.6);
    const pw = pts.map((_, i) => power * Math.pow(1 - i / (pts.length - 1), 0.55));
    const ch = { pts, width, power: pw, kind: 1, parent, at };
    channels.push(ch);
    if (depth >= 3) return;
    const kids = Math.floor(rand() * (4 - depth) * len * 0.9);
    for (let k = 0; k < kids; k++) {
      const i = Math.floor((0.15 + rand() * 0.6) * (pts.length - 1));
      const d = dir.clone().add(new THREE.Vector3(rand() - 0.5, -rand() * 0.5, rand() - 0.5).multiplyScalar(1.4)).normalize();
      if (d.y > 0.1) d.y = -d.y;
      branch(ch, i, d, len * (0.3 + rand() * 0.35), width * 0.75, pw[i] * 0.6, depth + 1);
    }
  };
  const mainBelowCloud = main.filter((p) => p.y < cloudBase + 0.4);
  const nb = 7 + Math.floor(rand() * 6);
  for (let b = 0; b < nb; b++) {
    // where off the main channel: weighted toward the top (under the cloud's base)
    const u = Math.pow(rand(), 1.6) * 0.85;
    const i = Math.floor(u * (mainBelowCloud.length - 1));
    const from = mainBelowCloud[i];
    const a = rand() * Math.PI * 2;
    const out = new THREE.Vector3(Math.cos(a), -(0.4 + rand() * 1.1), Math.sin(a)).normalize();
    const room = from.y - 0.3;
    const len = Math.min(room * 0.8, 1.0 + rand() * 2.8 * (1 - u * 0.6));
    branch(mainCh, main.indexOf(from), out, len, 0.0045, 0.32 + rand() * 0.25, 1);
  }
  // the fork low down, as often in photographs: one or two long arms that nearly reach the ground
  const forks = 1 + Math.floor(rand() * 2);
  for (let f = 0; f < forks; f++) {
    const i = Math.floor((0.62 + rand() * 0.18) * (main.length - 1));
    const from = main[i];
    const a = rand() * Math.PI * 2;
    const out = new THREE.Vector3(Math.cos(a) * 0.55, -1, Math.sin(a) * 0.55).normalize();
    branch(mainCh, i, out, from.y * (0.7 + rand() * 0.25), 0.0055, 0.5 + rand() * 0.2, 2);
  }
  // crawlers in the cloud's base: long, wandering, nearly level
  const nc = 3 + Math.floor(rand() * 4);
  for (let c = 0; c < nc; c++) {
    const from = main.reduce((best, p) => (Math.abs(p.y - cloudBase - 0.8) < Math.abs(best.y - cloudBase - 0.8) ? p : best));
    const a = rand() * Math.PI * 2;
    const len = 1.5 + rand() * 2.5;
    const end = from.clone().add(new THREE.Vector3(Math.cos(a) * len, rand() * 0.9, Math.sin(a) * len));
    const r = Math.hypot(end.x, end.z);
    if (r > 4.2) end.multiplyScalar(4.2 / r).setY(from.y + rand() * 0.9); // kept under the cloud
    const pts = fractalPath(rand, from, end, 7, 0.22, 0.8);
    const crawler = { pts, width: 0.004, power: pts.map((_, i) => 0.35 * (1 - i / (pts.length - 1))), kind: 1, parent: mainCh, at: main.indexOf(from) };
    channels.push(crawler);
    // and their own short drops
    for (let k = 0; k < 3; k++) {
      const j = Math.floor((0.2 + rand() * 0.7) * (pts.length - 1));
      const d = new THREE.Vector3(rand() - 0.5, -1.2, rand() - 0.5).normalize();
      branch(crawler, j, d, 0.4 + rand() * 1.2, 0.0032, 0.2 * (1 - j / pts.length), 3);
    }
  }
  // streamers rising from the ground to meet it
  const ns = 4 + Math.floor(rand() * 5);
  for (let s = 0; s < ns; s++) {
    const a = rand() * Math.PI * 2, r = 0.35 + rand() * 1.2;
    const base = new THREE.Vector3(strike.x + Math.cos(a) * r, 0, strike.z + Math.sin(a) * r);
    base.y = ground(base.x, base.z) + 0.02;
    const tip = base.clone().add(new THREE.Vector3((strike.x - base.x) * 0.25 + (rand() - 0.5) * 0.2, 0.2 + rand() * 0.45, (strike.z - base.z) * 0.25 + (rand() - 0.5) * 0.2));
    const pts = fractalPath(rand, base, tip, 4, 0.25, 0.6);
    channels.push({ pts, width: 0.0026, power: pts.map((_, i) => 0.18 * (1 - i / (pts.length - 1))), kind: 2 });
  }

  // ---- when the leader reaches each point, coming down from the cloud (0 as it comes out
  // of its base … 1 as it touches the ground): along the main channel at an even pace, each
  // branch from where it forks at about the same pace, but all of them done just before the
  // ground is reached (it stops them); the streamers rising off the grass as it comes near ----
  const along = (pts) => pts.reduce((a, p, i) => (a.push(i ? a[i - 1] + p.distanceTo(pts[i - 1]) : 0), a), []);
  {
    const d = along(main), L = d[d.length - 1];
    const exit = main.findIndex((p) => p.y < cloudBase);
    const d0 = exit > 0 ? d[exit] : 0, span = Math.max(1e-3, L - d0);
    mainCh.arrive = d.map((x) => (x - d0) / span);
    mainCh.gone = mainCh.arrive; // (when the tail runs past it, going)
    for (const ch of channels) {
      if (ch === mainCh) continue;
      const dd = along(ch.pts), len = dd[dd.length - 1] || 1e-3;
      if (ch.kind === 2) {
        const a0 = 0.8 + rand() * 0.1;
        ch.arrive = dd.map((x) => a0 + (x / len) * (0.985 - a0));
        ch.gone = dd.map(() => 1);
        continue;
      }
      const a0 = ch.parent.arrive[ch.at];
      const a1 = Math.min(a0 + len / span * 1.1, Math.max(a0 + 0.02, 0.97));
      ch.arrive = dd.map((x) => a0 + (x / len) * (a1 - a0));
      // going, it goes out close behind its fork, running out to its tip fast
      const g0 = ch.parent.gone[ch.at];
      ch.gone = dd.map((x) => g0 + (x / len) * 0.06);
    }
  }

  // ---- the ribbons ----
  const pos = [], tan = [], side = [], width = [], power = [], arrive = [], gone = [], idx = [];
  for (const ch of channels) {
    const { pts } = ch;
    const base = pos.length / 3;
    ch.base = base; // its first vertex in the ribbons' buffers
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      const t = b.clone().sub(a).normalize();
      const w = ch.width * (ch.kind === 0 ? 1 : 0.4 + 0.6 * Math.sqrt(ch.power[i] / (ch.power[0] || 1)));
      for (const s of [-1, 1]) {
        pos.push(p.x, p.y, p.z);
        tan.push(t.x, t.y, t.z);
        side.push(s);
        width.push(w);
        power.push(ch.power[i]);
        arrive.push(ch.arrive[i]);
        gone.push(ch.gone[i]);
      }
      if (i < pts.length - 1) {
        const k = base + i * 2;
        idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('tangent3', new THREE.Float32BufferAttribute(tan, 3));
  geo.setAttribute('side', new THREE.Float32BufferAttribute(side, 1));
  geo.setAttribute('width', new THREE.Float32BufferAttribute(width, 1));
  geo.setAttribute('power', new THREE.Float32BufferAttribute(power, 1));
  geo.setAttribute('arrive', new THREE.Float32BufferAttribute(arrive, 1));
  geo.setAttribute('gone', new THREE.Float32BufferAttribute(gone, 1));
  geo.setIndex(idx);
  geo.computeBoundingSphere();

  // the main channel resampled evenly, for the clouds and the rain to be lit by
  const samples = Array.from({ length: 24 }, () => new THREE.Vector3());
  resample(main, samples);

  return { geo, channels, samples, main };
}

export function createBolt(rand, opts) {
  const { cloudBase } = opts;
  let { top, strike } = opts;
  // a bolt's shape, and its points as built (its `rest`), to be bent from
  const shapeOf = ({ geo, channels, main }) => ({
    geo,
    channels,
    main,
    rest: channels.map((ch) => ch.pts.map((p) => p.clone())),
    chIndex: new Map(channels.map((ch, c) => [ch, c])),
  });
  const first = buildBolt(rand, opts);
  const { samples } = first;
  let cur = shapeOf(first);
  // where it comes out of the cloud (the shader fades it out above): the point it seems to
  // start from, kept with the strike when it strikes anew
  const viaOf = (main) => (main.find((p) => p.y < cloudBase - 0.6) ?? main[main.length >> 1]).clone();
  let via = viaOf(cur.main);

  // ---- striking anew: in a quarter of a second a run of bolts, each one a little like the one
  // before and a little more like the new one, until it is there ----
  const STRIKE_TIME = 0.25, STEPS = 9;
  let seq = null;
  let wr = null; // writhing: the wanders it goes between, how far from one to the next
  // a fractal wander that is nothing at both ends: a fractal path less the straight line
  const wander = (r, a, b, levels, rough, kink) => {
    const pts = fractalPath(r, a, b, levels, rough, kink);
    return pts.map((p, i) => p.sub(a.clone().lerp(b, i / (pts.length - 1))));
  };
  const mainWander = (r) => [...wander(r, top, via, 8, 0.26, 0.15).slice(0, -1), ...wander(r, via, strike, 8, 0.26, 0.15)];
  const t = new THREE.Vector3(), d = new THREE.Vector3();
  function write(shape) {
    const posArr = shape.geo.attributes.position.array, tanArr = shape.geo.attributes.tangent3.array;
    for (const ch of shape.channels) {
      if (ch.kind === 2) continue; // the streamers on the ground: never moved
      const { pts } = ch;
      for (let i = 0; i < pts.length; i++) {
        const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
        t.subVectors(b, a).normalize();
        for (let k = 0; k < 2; k++) {
          const o = (ch.base + i * 2 + k) * 3;
          posArr[o] = pts[i].x; posArr[o + 1] = pts[i].y; posArr[o + 2] = pts[i].z;
          tanArr[o] = t.x; tanArr[o + 1] = t.y; tanArr[o + 2] = t.z;
        }
      }
    }
    shape.geo.attributes.position.needsUpdate = true;
    shape.geo.attributes.tangent3.needsUpdate = true;
  }
  // `shape` bent so its main channel is `main`, each channel off it carried along with the
  // point it grows from, laid along the path `course(c)` gives it (its own as built if
  // none) and wandering by `amp` of a new fractal wander. With `byLength`, a channel grows
  // from as far along its parent as it did as built (the parent ran on past its tip, the
  // way back to it unchanged); without, from as far along in proportion (the parent shrunk).
  // With `toCourse` below 1, only that far from its shape as built to its course
  function bend(shape, main, amp, r, course, byLength = false, toCourse = 1) {
    shape.main.forEach((p, i) => p.copy(main[i]));
    shape.channels.forEach((ch, c) => {
      if (!ch.parent) return;
      const rest = shape.rest[c];
      const path = course?.(c);
      if (path) {
        resample(path, ch.pts);
        if (toCourse < 1) ch.pts.forEach((p, i) => p.lerpVectors(rest[i], p, toCourse));
      } else ch.pts.forEach((p, i) => p.copy(rest[i]));
      const pRest = shape.rest[shape.chIndex.get(ch.parent)];
      const root = byLength ? pathPrefix(ch.parent.pts, pathLength(pRest.slice(0, ch.at + 1))).at(-1) : ch.parent.pts[ch.at];
      d.subVectors(root, pRest[ch.at]);
      const w = amp > 0 ? wander(r, rest[0], rest[rest.length - 1], Math.log2(rest.length - 1), 0.26, 0.6) : null;
      ch.pts.forEach((p, i) => {
        p.add(d);
        if (w) p.addScaledVector(w[i], amp);
      });
    });
    write(shape);
    resample(shape.main, samples);
  }
  function show(shape) {
    for (const m of meshes) m.geometry = shape.geo;
    bolt.channels = shape.channels;
    bolt.main = shape.main;
  }

  const uniforms = {
    uPx: { value: 1 }, // world size of a pixel at unit distance
    uCloudBase: { value: cloudBase },
    uFlicker: { value: 1 }, // its brightness, flickering while it arcs
    uFront: { value: 1e3 }, // coming down: how far the leader has come (see arrive), all of it there past 1
    uTip: { value: 0 }, // and how bright its tip, the stepping front
    uTail: { value: -1e3 }, // going: how far its tail has run down after it (as uFront), the rest gone
    uPulse: { value: new THREE.Vector2(-1e3, 0) }, // a pulse of light running down it: where (as uFront), how bright
    uGlide: { value: -1 }, // held, a glow running down it the same way (see arrive)
    uGlow: { value: 0 }, // and how bright
  };
  const mat = (spread, minPx, color, gain, profile) =>
    new THREE.ShaderMaterial({
      uniforms: { ...uniforms, uSpread: { value: spread }, uMinPx: { value: minPx }, uColor: { value: new THREE.Color(color) }, uGain: { value: gain } },
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        attribute vec3 tangent3; attribute float side, width, power, arrive, gone;
        uniform float uPx, uSpread, uMinPx, uCloudBase;
        varying float vSide, vPower, vArrive, vGone, vMain;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vec3 t = normalize((modelViewMatrix * vec4(tangent3, 0.0)).xyz);
          vec3 perp = cross(t, normalize(mv.xyz));
          float pl = length(perp);
          perp = pl > 1e-4 ? perp / pl : vec3(1.0, 0.0, 0.0);
          float w = width * uSpread;
          float px = -mv.z * uPx * uMinPx; // never thinner than that many pixels…
          float we = max(w, px);
          vPower = power * (w / we); // …but then dimmer, so a far branch doesn't thicken
          // into the cloud: the channel is lost in it
          vArrive = arrive;
          vGone = gone;
          vMain = power * power; // 1 on the main channel, little in the branches
          vPower *= 1.0 - smoothstep(uCloudBase - 0.6, uCloudBase + 0.6, (modelMatrix * vec4(position, 1.0)).y);
          mv.xyz += perp * side * we;
          vSide = side;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor; uniform float uGain, uFlicker, uFront, uTip, uTail, uGlide, uGlow;
        uniform vec2 uPulse;
        varying float vSide, vPower, vArrive, vGone, vMain;
        void main() {
          // going: the part its tail has run past is gone, the tail's end glowing
          float after = vGone - uTail;
          if (after < 0.0) discard;
          // not there yet; and the leader's front, glowing hot
          float behind = uFront - vArrive;
          if (behind < 0.0) discard;
          float lit = uFlicker + uTip * exp(-behind * 28.0) + uTip * exp(-after * 28.0)
            + uPulse.y * exp(-abs(vArrive - uPulse.x) * 9.0) * step(vArrive, uPulse.x + 0.02);
          // held, now and then a glow running down it as the leader did: one bead of light
          // gliding down the main channel, a short tail behind it, the branches it passes
          // only touched by it
          float g = uGlide - vArrive;
          lit += uGlow * vMain * (g >= 0.0 ? exp(-g * 14.0) : exp(g * 45.0));
          float x = clamp(vSide, -1.0, 1.0); // MSAA can sample a varying past the strip's edge
          float k = max(${profile}, 0.0); // never negative: added, it would punch dark holes
          gl_FragColor = vec4(uColor * uGain * vPower * lit * k, 1.0);
        }`,
    });

  const group = new THREE.Group();
  const halo = new THREE.Mesh(cur.geo, mat(8, 3, 0x7a5cff, 0.14, 'exp(-x * x * 4.0) * 0.9 + exp(-x * x * 30.0) * 0.6'));
  const mid = new THREE.Mesh(cur.geo, mat(2.2, 1.6, 0xb8b0ff, 1.6, 'exp(-x * x * 5.0)'));
  const core = new THREE.Mesh(cur.geo, mat(1, 1.0, 0xfff8ff, 40, '1.0 - x * x'));
  const meshes = [halo, mid, core];
  for (const [m, o] of [[halo, 50], [mid, 51], [core, 52]]) {
    m.renderOrder = o;
    m.frustumCulled = false;
    group.add(m);
  }

  const bolt = {
    group,
    channels: cur.channels,
    samples, // moved in place: the rain's uniform holds them
    main: cur.main,
    get striking() {
      return !!seq;
    },
    // strike anew, from the same point out of the cloud to the same strike, in a new shape
    // (or, with `same`, a run of flashes that comes back to the shape it has)
    strikeAnew(r, same = false) {
      if (seq) return;
      const target = same ? cur : shapeOf(buildBolt(r, { ...opts, via }));
      // when each bolt of the run shows: unevenly spaced
      const gaps = Array.from({ length: STEPS }, () => 0.5 + r());
      const sum = gaps.reduce((x, y) => x + y);
      let acc = 0;
      const times = gaps.map((g) => (acc += (g / sum) * STRIKE_TIME));
      // the branches of the bolt it was carry on a little past their tips: each its own way
      // on, laid out now so they keep on it from one flash to the next
      const ext = cur.channels.map((ch, c) => {
        if (!ch.parent) return null;
        const rest = cur.rest[c], n = rest.length;
        const tip = rest[n - 1];
        const dir = tip.clone().sub(rest[Math.floor((n - 1) * 0.7)]).normalize();
        const len = Math.min(0.45, pathLength(rest) * (0.15 + r() * 0.15));
        const on = fractalPath(r, tip, tip.clone().addScaledVector(dir, len), Math.max(3, Math.round(Math.log2(n - 1)) - 1), 0.26, 0.6);
        return { path: [...rest, ...on.slice(1)], from: pathLength(rest), len };
      });
      seq = { r, from: cur, fromMain: cur.main.map((p) => p.clone()), target, times, t: 0, k: -1, ext };
    },
    // `dt` seconds on: whether a new bolt of the run shows, and whether the run is over;
    // with `wild` below 1 each bolt of the run strays less from the way between the two,
    // its branches running on less and shooting out from nearer their full length
    stepStrike(dt, wild = 1) {
      if (!seq) return { changed: false, done: false };
      seq.t += dt;
      let k = 0;
      while (k < STEPS && seq.t >= seq.times[k]) k++;
      if (k === seq.k) return { changed: false, done: false };
      seq.k = k;
      const { from, target, fromMain, r } = seq;
      if (k >= STEPS) {
        // there: the new bolt as built
        target.channels.forEach((ch, c) => ch.pts.forEach((p, i) => p.copy(target.rest[c][i])));
        write(target);
        resample(target.main, samples);
        show(target);
        if (from !== target) from.geo.dispose();
        cur = target;
        seq = null;
        return { changed: true, done: true };
      }
      // how far on: close at first to the bolt it was, then nearer and nearer the new one,
      // the wander most early on and fading as it closes in (and some always: two fractal
      // paths mixed lose their roughness)
      const f = (k + 1) / (STEPS + 1);
      const amp = wild * 0.8 * Math.sqrt(2 * f * (1 - f)) * Math.sqrt(1 - f);
      const w = mainWander(r);
      const goal = target.rest[0];
      const main = fromMain.map((p, i) => p.clone().lerp(goal[i], f).addScaledVector(w[i], amp));
      // the branches of the bolt it was for the first few, running on a little further each
      // flash past their tips; then those of the new one, shooting out from the main channel to
      // their full length (the main channel itself stays steady)
      const k0 = Math.ceil(STEPS * 0.4);
      let shape, course;
      if (k < k0) {
        shape = from;
        const e = (k + 1) / k0;
        course = (c) => seq.ext[c] && pathPrefix(seq.ext[c].path, seq.ext[c].from + e * wild * seq.ext[c].len);
      } else {
        shape = target;
        const g = 1 - wild * 0.75 * (1 - (k - k0 + 1) / (STEPS - k0 + 1));
        course = (c) => pathPrefix(target.rest[c], g * pathLength(target.rest[c]));
      }
      bend(shape, main, amp * 0.6, r, course, k < k0, wild);
      show(shape);
      return { changed: true, done: false };
    },
    // a whole new bolt, from somewhere else in the cloud down to somewhere else (`o`: its
    // top, strike and ground), shown at once in place of the one there
    replace(r, o) {
      seq = null;
      opts = { ...opts, ...o };
      ({ top, strike } = opts);
      const next = shapeOf(buildBolt(r, opts));
      resample(next.main, samples);
      show(next);
      cur.geo.dispose();
      cur = next;
      wr = null;
      via = viaOf(cur.main);
    },
    // the leader coming down: how far (0 out of the cloud … 1 at the ground; more, all
    // there) and how bright its front
    setFront(f, tip = 0) {
      uniforms.uFront.value = f;
      uniforms.uTip.value = tip;
    },
    // the channel writhing as it goes: bent, frame by frame, from one wander of its shape to
    // the next (the ends kept: where it comes out of the cloud, and the strike), amp how
    // far, speed how many shapes a second; its branches dragged along, lashing with it.
    // kick: a new shape at once (each return stroke down it); amp 0: back as built
    writhe(r, dt, amp, speed, kick = false) {
      if (seq) return;
      const rest = cur.rest[0];
      if (amp <= 0) {
        wr = null;
        return bend(cur, rest, 0, r);
      }
      if (!wr) wr = { a: mainWander(r), b: mainWander(r), f: 0, seed: r() * 1e9 };
      wr.f += dt * speed;
      if (kick || wr.f >= 1) {
        const k = Math.min(1, wr.f), e = k * k * (3 - 2 * k);
        wr.a = wr.a.map((p, i) => p.lerp(wr.b[i], e));
        wr.b = mainWander(r);
        wr.f = kick ? 0.35 : wr.f % 1;
        wr.seed = r() * 1e9;
      }
      const e = wr.f * wr.f * (3 - 2 * wr.f);
      const main = rest.map((p, i) => p.clone().addScaledVector(wr.a[i], amp * (1 - e)).addScaledVector(wr.b[i], amp * e));
      bend(cur, main, amp * (kick ? 0.6 : 0.35), rng(wr.seed));
    },
    // going: its tail run down to f (as setFront; -1e3 all of it there), its end glowing tip
    setTail(f, tip = 0) {
      uniforms.uTail.value = f;
      uniforms.uTip.value = tip;
    },
    // a pulse of light running down it, at f (as setFront), k bright (0 none)
    setPulse(f, k) {
      uniforms.uPulse.value.set(f, k);
    },
    // held: a glow running down it, `f` how far (like the leader's front), `k` how bright
    setGlide(f, k) {
      uniforms.uGlide.value = f;
      uniforms.uGlow.value = k;
    },
    setFlicker(k) {
      uniforms.uFlicker.value = k;
    },
    setPx(camera, heightPx) {
      uniforms.uPx.value = (2 * Math.tan((camera.fov * Math.PI) / 360)) / heightPx;
    },
  };
  return bolt;
}
