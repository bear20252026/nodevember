// The room: the round hall of an observatory at night. A parquet floor, walls
// of dark panelled wood with a brass rail, and above, the iron dome — ribs,
// rings and rivets, glazed — open on the sky: a deep blue full of stars, the
// Milky Way across it, and, enormous above the hall, a ringed planet.
// A brass telescope on its tripod points up at it; an oil lamp on a desk.
import * as THREE from 'three';
import { woodTexture, planetTextures, ringTexture } from './textures.js';
import { GLSL_NOISE } from './noise.js';
import { glowTexture } from './orrery.js';

export const ROOM_R = 9;
export const WALL_H = 1.4;

// towards the giant planet, the cold light it throws into the room
export const GIANT_DIR = new THREE.Vector3(-0.9, 0.42, -0.15).normalize();

const skyShader = {
  uniforms: { uTime: { value: 0 } },
  vertexShader: /* glsl */ `
    varying vec3 vDir;
    void main() {
      vDir = position;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    varying vec3 vDir;
    uniform float uTime;
    ${GLSL_NOISE}
    float stars(vec3 d, float scale, float th) {
      vec3 p = d * scale, i = floor(p), f = fract(p);
      vec3 h = hash33(i);
      float b = step(th, h.x);
      float r = length(f - (0.25 + h * 0.5));
      float tw = 0.75 + 0.25 * sin(uTime * (1.0 + h.y * 3.0) + h.z * 40.0);
      return b * smoothstep(0.09 + h.y * 0.06, 0.0, r) * (0.4 + h.z * 1.6) * tw;
    }
    void main() {
      vec3 d = normalize(vDir);
      float y = d.y;
      // deep night blue, a little lighter low down
      vec3 c = mix(vec3(0.05, 0.085, 0.17), vec3(0.012, 0.022, 0.06), smoothstep(-0.1, 0.9, y));
      // the Milky Way: a tilted band, clouded
      vec3 axis = normalize(vec3(0.35, 0.55, 0.76));
      float band = dot(d, axis);
      float cloud = fbm3(d * 3.0 + 4.0) * 0.6 + fbm3(d * 9.0) * 0.4;
      float mw = exp(-band * band * 18.0) * smoothstep(0.3, 0.75, cloud);
      c += vec3(0.35, 0.4, 0.5) * mw * 0.55;
      // stars, many small, few bright, more in the band
      float s = stars(d, 180.0, 0.82) * 0.6 + stars(d, 90.0, 0.93) + stars(d, 40.0, 0.975) * 2.5;
      s += stars(d, 260.0, 0.7) * exp(-band * band * 14.0) * 0.6;
      c += vec3(1.0, 0.95, 0.85) * s;
      gl_FragColor = vec4(c, 1.0);
    }`,
};

export function createRoom(env, M) {
  const group = new THREE.Group();
  const lights = [];

  // ---- the sky
  const sky = new THREE.Mesh(new THREE.SphereGeometry(90, 48, 24), new THREE.ShaderMaterial({
    ...skyShader, uniforms: THREE.UniformsUtils.clone(skyShader.uniforms), side: THREE.BackSide, depthWrite: false,
  }));
  sky.renderOrder = -10;
  sky.userData.sky = true;
  group.add(sky);

  // ---- the giant planet in the sky, lit from far off by a sun we don't see
  const tex = planetTextures();
  const giant = new THREE.Group();
  giant.position.copy(GIANT_DIR).multiplyScalar(75);
  giant.rotation.set(0.1, 0.0, 0.42);
  giant.scale.setScalar(1.25); // the hero of the plate: a little larger than life
  // lit from far off by a sun we don't see: shaded in its own shader, so the
  // room's lights don't touch it
  const LIGHT = new THREE.Vector3(0.75, 0.15, 0.55).normalize();
  const lit = (map, ring) => new THREE.ShaderMaterial({
    uniforms: { map: { value: map }, uLight: { value: LIGHT } },
    transparent: ring, side: ring ? THREE.DoubleSide : THREE.FrontSide, depthWrite: !ring,
    vertexShader: /* glsl */ `
      varying vec2 vUv; varying vec3 vN; varying vec3 vP;
      void main() {
        vUv = uv;
        vN = normalize(mat3(modelMatrix) * normal);
        vP = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * viewMatrix * vec4(vP, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D map; uniform vec3 uLight;
      varying vec2 vUv; varying vec3 vN; varying vec3 vP;
      void main() {
        vec4 t = texture2D(map, vUv);
        vec3 c = t.rgb; // sRGB textures are decoded when sampled
        float l = ${ring ? '0.55 + 0.45 * abs(dot(normalize(vN), uLight))' : 'smoothstep(-0.15, 0.6, dot(normalize(vN), uLight))'};
        gl_FragColor = vec4(c * l * 1.25 + c * 0.015, t.a);
      }`,
  });
  const gBall = new THREE.Mesh(new THREE.SphereGeometry(9.5, 96, 64), lit(tex.giant, false));
  giant.add(gBall);
  const rg = new THREE.RingGeometry(12.5, 22, 192, 1);
  {
    const uv = rg.attributes.uv, pos = rg.attributes.position;
    for (let v = 0; v < uv.count; v++) uv.setXY(v, (Math.hypot(pos.getX(v), pos.getY(v)) - 12.5) / 9.5, 0.5);
  }
  const gRing = new THREE.Mesh(rg, lit(ringTexture(5), true));
  gRing.rotation.x = -Math.PI / 2;
  gRing.userData.strokes = 'ring'; // engraved in circles, though it's see-through
  giant.add(gRing);
  group.add(giant);

  // ---- the cold light from the sky through the glass, casting long shadows
  const skyLight = new THREE.DirectionalLight(0x8fa8d8, 0.55);
  skyLight.position.copy(GIANT_DIR).multiplyScalar(14);
  skyLight.castShadow = true;
  skyLight.shadow.mapSize.set(2048, 2048);
  const sc = skyLight.shadow.camera;
  sc.left = sc.bottom = -10;
  sc.right = sc.top = 10;
  sc.near = 1;
  sc.far = 40;
  skyLight.shadow.bias = -0.0008;
  skyLight.shadow.normalBias = 0.03;
  group.add(skyLight);
  const hemi = new THREE.HemisphereLight(0x3a4c78, 0x1c120a, 0.35);
  group.add(hemi);

  // ---- the floor: parquet in a circle
  const floorTex = woodTexture({ seed: 4, base: 0x2e170b, light: 0x5c3218, planks: 8, scale: 1.2, w: 1024, h: 1024 });
  floorTex.repeat.set(3, 3);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(ROOM_R, 96), new THREE.MeshStandardMaterial({
    map: floorTex, roughness: 0.45, metalness: 0, envMap: env, envMapIntensity: 0.4,
  }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  group.add(floor);
  // a round carpet under the orrery, dark red with a border
  const carpet = new THREE.Mesh(new THREE.CircleGeometry(2.4, 96), new THREE.MeshStandardMaterial({ map: carpetTexture(), roughness: 1 }));
  carpet.rotation.x = -Math.PI / 2;
  carpet.position.y = 0.006;
  carpet.receiveShadow = true;
  group.add(carpet);

  // ---- the walls: panelled wood, a dado rail, a brass rail on top
  const wallTex = woodTexture({ seed: 8, base: 0x2a140a, light: 0x4e2814, w: 512, h: 512, scale: 0.6 });
  wallTex.repeat.set(24, 1);
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(ROOM_R, ROOM_R, WALL_H, 128, 1, true), new THREE.MeshStandardMaterial({
    map: wallTex, roughness: 0.5, side: THREE.BackSide, envMap: env, envMapIntensity: 0.3,
  }));
  wall.position.y = WALL_H / 2;
  wall.receiveShadow = true;
  wall.userData.strokes = 'rings'; // hatched in level courses
  group.add(wall);
  // pilasters between the panels
  // the dome is turned so that one of its bays faces the giant, square on
  // (the round window is in a bay well away from it; see below); the
  // pilasters turn with it
  const DOME_TURN = Math.atan2(-GIANT_DIR.z, GIANT_DIR.x) - (3.5 / 8) * Math.PI * 2;
  const pil = new THREE.InstancedMesh(new THREE.BoxGeometry(0.22, WALL_H, 0.12), new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.5, color: 0xbb9988 }), 16);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  // (sixteen, under the feet of the dome's great and lesser ribs)
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2 - DOME_TURN;
    e.set(0, -a + Math.PI / 2, 0);
    q.setFromEuler(e);
    m4.compose(new THREE.Vector3(Math.cos(a) * (ROOM_R - 0.06), WALL_H / 2, Math.sin(a) * (ROOM_R - 0.06)), q, new THREE.Vector3(1, 1, 1));
    pil.setMatrixAt(k, m4);
  }
  pil.receiveShadow = pil.castShadow = true;
  group.add(pil);
  for (const [y, r, t, mat] of [[0.55, ROOM_R - 0.08, 0.03, M.brassDark], [WALL_H, ROOM_R - 0.1, 0.07, M.brass], [0.08, ROOM_R - 0.05, 0.06, M.iron]]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, t, 8, 160), mat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = y;
    group.add(ring);
  }

  // ---- the dome: cast and wrought iron, as the glasshouses and reading rooms
  // of the day were built — regular, but in a hierarchy. Eight great ribs
  // run up to the oculus; between them lesser ribs stop at a ring part way
  // up, and lesser still lower down, so the web thins as it rises instead of
  // bunching at the top. Every member tapers, heavy at its foot and fine at
  // its head; the rings too, from a heavy curb to a hairline near the top.
  // Hairline glazing bars split the panes; scroll brackets take the ribs'
  // feet on the pilasters; an openwork lantern crowns the oculus. Rivets
  // only along the great ribs. In one bay, well round from the one that
  // faces the giant, between heavier ribs, the web is cleared for a round
  // window in a thick iron frame.
  const DOME_R = ROOM_R;
  const OCUL = 1.32; // the latitude of the oculus
  const dome = new THREE.Group();
  dome.position.y = WALL_H;
  dome.rotation.y = DOME_TURN;
  group.add(dome);
  const ease = (t) => t * t * (3 - 2 * t);
  // a rib in the xy plane, from +x up towards +y, its outer face against the
  // glass, deeper than it is wide, tapering from w0 at its foot to w1
  const ribW = (lat, lat0, lat1, w0, w1, flare) =>
    (w0 + (w1 - w0) * Math.pow((lat - lat0) / (lat1 - lat0), 0.75)) * (1 + flare * Math.exp(-(lat - lat0) / 0.05));
  // (from, to: only that stretch of it, where the window cuts it)
  const rib = (lat0, lat1, w0, w1, flare = 0.5, from = lat0, to = lat1) => {
    const pts = [], rad = [];
    const n = Math.max(4, Math.round((to - from) * 60));
    for (let i = 0; i <= n; i++) {
      const lat = from + ((to - from) * i) / n;
      const w = ribW(lat, lat0, lat1, w0, w1, flare);
      const d = w * 1.7, r = DOME_R - 0.02 - d;
      pts.push(new THREE.Vector3(Math.cos(lat) * r, Math.sin(lat) * r, 0));
      rad.push([w, d]);
    }
    return sweep(pts, rad, 8);
  };
  const instanced = (geo, mat, angles, scale = 1) => {
    const im = new THREE.InstancedMesh(geo, mat, angles.length);
    angles.forEach((a, k) => {
      e.set(0, a, 0);
      q.setFromEuler(e);
      im.setMatrixAt(k, m4.compose(new THREE.Vector3(), q, new THREE.Vector3(scale, scale, scale)));
    });
    im.castShadow = true;
    im.userData.strokes = 'tube';
    dome.add(im);
    return im;
  };
  const MAIN = 8;
  const at = (n, off = 0) => Array.from({ length: n }, (_, k) => ((k + off) / n) * Math.PI * 2);
  const mainA = at(MAIN), secA = at(MAIN, 0.5);
  // the window: a circle on the dome, three bays round from the one that
  // faces the giant (near it, a window only fights it), seven tenths as
  // wide as its bay at
  // the giant's height, and set high, its frame hung from the ring above;
  // tie bars hold it to the beams either side
  const WIN_BAYS = [6];
  const winAzs = WIN_BAYS.map((k) => secA[k]);
  const eye = new THREE.Vector3(0, 0.9 - WALL_H, 0), toG = giant.position.clone().sub(new THREE.Vector3(0, 0.9, 0)).normalize();
  const bq = eye.dot(toG), hitT = -bq + Math.sqrt(bq * bq - eye.lengthSq() + DOME_R * DOME_R);
  const giantLat = Math.asin(eye.clone().addScaledVector(toG, hitT).y / DOME_R);
  const WIN_T = 0.13; // the frame's half-thickness
  const winRho = 0.7 * (Math.asin(Math.cos(giantLat) * Math.sin(Math.PI / MAIN)) - 0.012);
  const WIN_UNDER = 0.86; // the ring it hangs from
  const winLat = WIN_UNDER - winRho - (WIN_T * 1.1) / DOME_R;
  const winPad = (WIN_T * 0.8) / DOME_R; // the web stops at the frame
  const winCos = (lat, az, w) => Math.sin(lat) * Math.sin(winLat) + Math.cos(lat) * Math.cos(winLat) * Math.cos(az - w);
  const inWin = (lat, az) => winAzs.some((w) => winCos(lat, az, w) > Math.cos(winRho + winPad));
  // a set of meridian members (rib args), cut where they cross the window
  const meridians = (args, mat, angles) => {
    const whole = [];
    for (const a of angles) {
      const [lat0, lat1] = args;
      const runs = [];
      let start = null;
      const N = 400;
      for (let i = 0; i <= N; i++) {
        const lat = lat0 + ((lat1 - lat0) * i) / N, out = !inWin(lat, a);
        if (out && start === null) start = lat;
        if ((!out || i === N) && start !== null) {
          if (lat - start > 0.01) runs.push([start, lat]);
          start = null;
        }
      }
      if (runs.length === 1 && runs[0][0] === lat0 && runs[0][1] === lat1) { whole.push(a); continue; }
      for (const [from, to] of runs) {
        const m = new THREE.Mesh(rib(...args.slice(0, 4), from === lat0 ? args[4] : 0, from, to), mat);
        m.rotation.y = a;
        m.castShadow = true;
        m.userData.strokes = 'tube';
        dome.add(m);
      }
    }
    if (whole.length) instanced(rib(...args), mat, whole);
  };
  // a horizontal arc at a latitude, from angle a0 to a1 (a0 < a1)
  const arc = (lat, r, t, sides, mat, a0, a1, segs = 192) => {
    const geo = new THREE.TorusGeometry(Math.cos(lat) * r, t, sides, Math.max(8, Math.round((segs * (a1 - a0)) / (Math.PI * 2))), a1 - a0);
    // (a torus arc starts at +x, turning towards +y; laid flat, that is
    // towards +z, the opposite way to the ribs' angles)
    geo.rotateZ(-a1);
    const m = new THREE.Mesh(geo, mat);
    m.rotation.x = Math.PI / 2;
    m.position.y = Math.sin(lat) * r;
    m.castShadow = true;
    dome.add(m);
    return m;
  };
  // a horizontal ring or bar at a latitude, with gaps where the windows are
  const hoop = (lat, r, t, sides, mat) => {
    const c = (Math.cos(winRho + winPad) - Math.sin(lat) * Math.sin(winLat)) / (Math.cos(lat) * Math.cos(winLat));
    const gap = Math.abs(c) < 1 ? Math.acos(c) : 0;
    const g = new THREE.Group();
    if (!gap) g.add(arc(lat, r, t, sides, mat, 0, Math.PI * 2));
    else {
      const ws = [...winAzs].sort((x, y) => x - y);
      ws.forEach((w, i) => g.add(arc(lat, r, t, sides, mat, w + gap, (i + 1 < ws.length ? ws[i + 1] : ws[0] + Math.PI * 2) - gap)));
    }
    dome.add(g);
    return g;
  };
  // the rings: [latitude, half-thickness]; the curb sits right on the brass
  // rail along the top of the wall, one cornice with it
  const RINGS = [[0.0175, 0.085], [0.4, 0.06], [0.86, 0.04], [1.12, 0.026]];
  // the two great ribs either side of the window are heavier: beams
  const MAIN_W = [0.085, 0.038, 0.7], BEAM_W = [0.17, 0.07, 0.5];
  const beamA = WIN_BAYS.flatMap((k) => [mainA[k], mainA[(k + 1) % MAIN]]);
  instanced(rib(0, OCUL, ...MAIN_W), M.iron, mainA.filter((a) => !beamA.includes(a)));
  instanced(rib(0, OCUL, ...BEAM_W), M.iron, beamA);
  meridians([0, 0.86, 0.055, 0.032, 0.5], M.iron, secA);
  // the least, halfway between each great rib and the lesser beside it
  meridians([0, 0.4, 0.038, 0.028, 0.5], M.iron, at(MAIN * 2, 0.5));
  for (const [lat, t] of RINGS) hoop(lat, DOME_R - 0.02 - t * 1.4, t, 8, M.iron);
  // hairline glazing bars: up the slope between the ribs in the two upper
  // zones, stopping short of the top so they never crowd; and a lap now and
  // then across
  meridians([0.4, 0.86, 0.013, 0.012, 0], M.iron, at(MAIN * 2, 0.5));
  meridians([0.86, 1.12, 0.012, 0.011, 0], M.iron, secA);
  for (const lat of [0.2, 0.62, 0.99]) hoop(lat, DOME_R - 0.035, 0.011, 5, M.iron).traverse((o) => (o.castShadow = false));
  // each window's frame: a thick iron ring lying in the dome; a brass bead
  // inside it, and a ring of rivets
  for (const winAz of winAzs) {
    const C = new THREE.Vector3(Math.cos(winLat) * Math.cos(winAz), Math.sin(winLat), -Math.cos(winLat) * Math.sin(winAz));
    const rf = DOME_R - 0.02 - WIN_T * 1.3;
    const frame = new THREE.Group();
    frame.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), C);
    dome.add(frame);
    const ring = (rho, t, depth, mat, r = rf) => {
      const m = new THREE.Mesh(new THREE.TorusGeometry(Math.sin(rho) * r, t, 12, 160), mat);
      m.position.z = Math.cos(rho) * r;
      m.scale.z = depth;
      m.castShadow = true;
      frame.add(m);
      return m;
    };
    ring(winRho, WIN_T, 1.3, M.iron);
    // a lip on the outside, against the glass, and the bead within
    ring(winRho + 0.004, WIN_T * 0.45, 1, M.iron, DOME_R - 0.04);
    ring(winRho - (WIN_T * 1.05) / rf, 0.03, 1, M.brassDark, rf - 0.06);
    const n = 36, rr = rf - WIN_T * 1.25;
    const riv = new THREE.InstancedMesh(new THREE.SphereGeometry(0.028, 8, 6), M.brassDark, n);
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      riv.setMatrixAt(k, m4.makeTranslation(Math.cos(a) * Math.sin(winRho) * rr, Math.sin(a) * Math.sin(winRho) * rr, Math.cos(winRho) * rr));
    }
    frame.add(riv);
    // the ties: level bars from the frame, at its middle, to the beams
    const L = winLat, tr = DOME_R - 0.02 - 0.05 * 1.6;
    const half = Math.acos((Math.cos(winRho) - Math.sin(L) ** 2) / Math.cos(L) ** 2);
    for (const side of [-1, 1]) {
      const a0 = winAz + side * half, a1 = winAz + (side * Math.PI) / MAIN;
      arc(L, tr, 0.05, 8, M.iron, Math.min(a0, a1), Math.max(a0, a1));
    }
  }
  // scroll brackets under the feet of the great and lesser ribs, on the
  // pilasters: a back plate, a top plate, and a C-scroll between them
  instanced(bracketGeometry(ROOM_R - 0.12, 1.45), M.iron, mainA);
  instanced(bracketGeometry(ROOM_R - 0.12, 1.0), M.iron, secA);
  // the oculus: a heavy brass compression ring, and over it an openwork
  // lantern — slender posts, round arches between them, a ribbed cap and a
  // finial against the sky
  const oR = Math.cos(OCUL) * (DOME_R - 0.1), oY = Math.sin(OCUL) * (DOME_R - 0.1);
  const ocul = new THREE.Mesh(new THREE.TorusGeometry(oR, 0.1, 10, 96), M.brassDark);
  ocul.rotation.x = Math.PI / 2;
  ocul.position.y = oY;
  dome.add(ocul);
  const lantern = new THREE.Group();
  lantern.position.y = oY;
  dome.add(lantern);
  const POSTS = 16, POST_H = 0.42, lR = oR - 0.02;
  const half = Math.PI / POSTS;
  const posts = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.022, 0.03, POST_H, 8), M.iron, POSTS);
  // the arches: half circles from post to post, in the plane of the chord
  const archR = lR * Math.sin(half);
  const arches = new THREE.InstancedMesh(new THREE.TorusGeometry(archR, 0.016, 6, 24, Math.PI), M.iron, POSTS);
  for (let k = 0; k < POSTS; k++) {
    const a = k * half * 2;
    m4.makeTranslation(Math.cos(a) * lR, 0.08 + POST_H / 2, -Math.sin(a) * lR);
    posts.setMatrixAt(k, m4);
    const am = a + half, cr = lR * Math.cos(half);
    e.set(0, am + Math.PI / 2, 0);
    q.setFromEuler(e);
    arches.setMatrixAt(k, m4.compose(new THREE.Vector3(Math.cos(am) * cr, 0.08 + POST_H, -Math.sin(am) * cr), q, new THREE.Vector3(1, 1, 1)));
  }
  const capY = 0.08 + POST_H + archR;
  for (const [y, t] of [[0.08, 0.035], [capY, 0.03]]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(lR, t, 8, 96), M.iron);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = y;
    lantern.add(ring);
  }
  lantern.add(posts, arches);
  // the cap: eight ribs curving in to a finial, each a little ogee
  const capH = 1.0, capPts = [], capRad = [];
  for (let i = 0; i <= 32; i++) {
    const t = i / 32;
    const r = lR * (1 - ease(t)) * (1 + 0.18 * Math.sin(Math.PI * t)), y = capY + capH * Math.sin((t * Math.PI) / 2) ** 0.8;
    capPts.push(new THREE.Vector3(Math.max(r, 0.03), y, 0));
    const w = 0.035 - 0.02 * t;
    capRad.push([w, w * 1.3]);
  }
  const cap = new THREE.InstancedMesh(sweep(capPts, capRad, 6), M.iron, MAIN);
  mainA.forEach((a, k) => {
    e.set(0, a, 0);
    q.setFromEuler(e);
    cap.setMatrixAt(k, m4.compose(new THREE.Vector3(), q, new THREE.Vector3(1, 1, 1)));
  });
  cap.userData.strokes = 'tube';
  lantern.add(cap);
  const finial = new THREE.Mesh(new THREE.LatheGeometry([
    [0, 0], [0.07, 0.02], [0.05, 0.08], [0.09, 0.16], [0.03, 0.26], [0.015, 0.5], [0, 0.58],
  ].map(([r, y]) => new THREE.Vector2(r, y)), 16), M.brassDark);
  finial.position.y = capY + capH - 0.03;
  lantern.add(finial);
  // rivets: only along the great ribs, in pairs where they cross the rings,
  // and a row up their feet
  const rivPos = [];
  for (const a of mainA) {
    const put = (lat, side) => {
      const r = DOME_R - 0.02 - 2 * 1.7 * ribW(lat, 0, OCUL, ...(beamA.includes(a) ? BEAM_W : MAIN_W));
      const p = new THREE.Vector3(Math.cos(lat) * r, Math.sin(lat) * r, side);
      rivPos.push(p.applyAxisAngle(new THREE.Vector3(0, 1, 0), a));
    };
    for (const [lat] of RINGS.slice(1)) for (const s of [-1, 1]) put(lat + s * 0.03, 0);
    for (let k = 1; k <= 4; k++) put(k * 0.055, 0);
  }
  const rivets = new THREE.InstancedMesh(new THREE.SphereGeometry(0.03, 8, 6), M.brassDark, rivPos.length);
  rivPos.forEach((p, k) => rivets.setMatrixAt(k, m4.makeTranslation(p.x, p.y, p.z)));
  dome.add(rivets);
  // the glass: faintly tinted, catching a little light
  const glass = new THREE.Mesh(new THREE.SphereGeometry(DOME_R, 64, 24, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({
    color: 0x6b85a8, transparent: true, opacity: 0.08, roughness: 0.35, metalness: 0, side: THREE.BackSide, depthWrite: false, envMap: env, envMapIntensity: 0.6,
  }));
  dome.add(glass);

  // ---- the telescope: brass tube on an oak tripod, aimed at the giant
  const scope = new THREE.Group();
  scope.position.set(-4.4, 0, 3.6);
  group.add(scope);
  const oak = new THREE.MeshStandardMaterial({ map: woodTexture({ seed: 2, base: 0x3d2210, light: 0x6b4020, w: 256, h: 256 }), roughness: 0.6 });
  const head = new THREE.Vector3(0, 1.45, 0);
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2 + 0.3;
    const foot = new THREE.Vector3(Math.cos(a) * 0.7, 0, Math.sin(a) * 0.7);
    const len = foot.distanceTo(head);
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, len, 0.035), oak);
    leg.position.copy(foot).add(head).multiplyScalar(0.5);
    leg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), head.clone().sub(foot).normalize());
    leg.castShadow = leg.receiveShadow = true;
    scope.add(leg);
  }
  const mount = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.12, 20), M.brassDark);
  mount.position.copy(head);
  scope.add(mount);
  const tubeAim = new THREE.Group();
  tubeAim.position.copy(head).add(new THREE.Vector3(0, 0.12, 0));
  const aimAt = giant.position.clone().sub(scope.position).sub(tubeAim.position).normalize();
  tubeAim.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), aimAt);
  scope.add(tubeAim);
  const tube = new THREE.Mesh(new THREE.LatheGeometry([
    [0.0, -0.75], [0.035, -0.75], [0.035, -0.62], [0.05, -0.6], [0.06, -0.3], [0.075, 0.3], [0.08, 0.95], [0.1, 0.98], [0.1, 1.15], [0.088, 1.15],
  ].map(([r, y]) => new THREE.Vector2(r, y)), 32), M.brass);
  tube.castShadow = true;
  tubeAim.add(tube);
  for (const y of [-0.3, 0.3, 0.95]) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(y < 0 ? 0.064 : y < 0.5 ? 0.078 : 0.083, 0.012, 8, 32), M.brassDark);
    band.rotation.x = Math.PI / 2;
    band.position.y = y;
    tubeAim.add(band);
  }
  const finder = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, 0.5, 12), M.brassDark);
  finder.position.set(0.12, 0.35, 0);
  tubeAim.add(finder);

  // ---- a desk against the wall, books, an oil lamp burning low
  const desk = new THREE.Group();
  const deskA = Math.PI * 0.18;
  desk.position.set(Math.cos(deskA) * (ROOM_R - 1.0), 0, Math.sin(deskA) * (ROOM_R - 1.0));
  desk.rotation.y = -deskA - Math.PI / 2;
  group.add(desk);
  const mahog = new THREE.MeshStandardMaterial({ map: woodTexture({ seed: 6, base: 0x3a1a0c, light: 0x5e2c14, w: 256, h: 256 }), roughness: 0.4, envMap: env, envMapIntensity: 0.4 });
  const top = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.07, 0.9), mahog);
  top.position.y = 0.88;
  desk.add(top);
  for (const [x, z] of [[-0.9, -0.38], [0.9, -0.38], [-0.9, 0.38], [0.9, 0.38]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.025, 0.85, 10), mahog);
    leg.position.set(x, 0.425, z);
    desk.add(leg);
  }
  const bookCols = [0x5a1c14, 0x1f3326, 0x2b2238, 0x6a4a1c, 0x3a1810];
  for (let k = 0; k < 5; k++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.5 - k * 0.03, 0.07, 0.36 - k * 0.015), new THREE.MeshStandardMaterial({ color: bookCols[k], roughness: 0.7 }));
    b.position.set(0.5, 0.95 + k * 0.07, 0.05);
    b.rotation.y = (k * 0.37) % 0.4 - 0.2;
    desk.add(b);
  }
  // the lamp: a brass foot, a glass globe glowing
  const lampFoot = new THREE.Mesh(new THREE.LatheGeometry([
    [0, 0], [0.12, 0], [0.12, 0.02], [0.05, 0.06], [0.03, 0.2], [0.09, 0.26], [0.06, 0.3], [0, 0.3],
  ].map(([r, y]) => new THREE.Vector2(r, y)), 24), M.brass);
  lampFoot.position.set(-0.55, 0.915, 0);
  desk.add(lampFoot);
  const globe = new THREE.Mesh(new THREE.SphereGeometry(0.11, 24, 16), new THREE.MeshStandardMaterial({ color: 0, emissive: 0xffb050, emissiveIntensity: 5 }));
  globe.position.set(-0.55, 1.33, 0);
  desk.add(globe);
  const lampGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xff9a40, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.3 }));
  lampGlow.scale.setScalar(1.1);
  lampGlow.position.copy(globe.position);
  desk.add(lampGlow);
  const lampLight = new THREE.PointLight(0xff9a48, 2.2, 0, 2);
  lampLight.position.copy(globe.position);
  desk.add(lampLight);
  const chair = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.5), mahog);
  chair.position.set(-0.2, 0.5, -0.65);
  desk.add(chair);

  group.traverse((o) => {
    if (o.isMesh && o !== sky && o !== glass && !giant.children.includes(o)) o.receiveShadow = true;
  });

  function update(dt, time) {
    sky.material.uniforms.uTime.value = time;
    giant.rotation.y += dt * 0.004;
    lampLight.intensity = 2.2 * (0.9 + 0.1 * Math.sin(time * 9.0) * Math.sin(time * 3.7));
  }
  return { group, sky, glass, giant, update };
}

// a tube swept along points lying in the xy plane, its section an ellipse:
// rad[i] = [half-width across the plane (z), half-depth in it]. Its uv run
// along it (x) and round it (y), as a TubeGeometry's, for the engraving.
function sweep(pts, rad, sides = 8) {
  const n = pts.length, pos = [], nor = [], uv = [], idx = [];
  const T = new THREE.Vector3(), N = new THREE.Vector3(), Z = new THREE.Vector3(0, 0, 1), p = new THREE.Vector3(), nn = new THREE.Vector3();
  let len = 0;
  const acc = [0];
  for (let i = 1; i < n; i++) acc.push((len += pts[i].distanceTo(pts[i - 1])));
  for (let i = 0; i < n; i++) {
    T.subVectors(pts[Math.min(i + 1, n - 1)], pts[Math.max(i - 1, 0)]).normalize();
    N.crossVectors(Z, T).normalize();
    const [w, d] = rad[i];
    for (let j = 0; j <= sides; j++) {
      const a = (j / sides) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      p.copy(pts[i]).addScaledVector(N, c * d).addScaledVector(Z, s * w);
      nn.copy(N).multiplyScalar(c / d).addScaledVector(Z, s / w).normalize();
      pos.push(p.x, p.y, p.z);
      nor.push(nn.x, nn.y, nn.z);
      uv.push(acc[i] / len, j / sides);
    }
  }
  for (let i = 0; i < n - 1; i++)
    for (let j = 0; j < sides; j++) {
      const a = i * (sides + 1) + j, b = a + sides + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

// a cast-iron console under a rib's foot, in the xy plane against a wall at
// x = wallX (dome coordinates: y = 0 at the top of the wall): a plate up the
// wall, a plate under the rib, and between them a C-scroll, its two volutes
// curling back towards the wall
function bracketGeometry(wallX, k) {
  const P = (d, y) => new THREE.Vector3(wallX - d * k, y * k, 0);
  const parts = [];
  const add = (pts, w0, w1) => parts.push(sweep(pts, pts.map((_, i) => {
    const w = (w0 + ((w1 - w0) * i) / (pts.length - 1)) * (0.7 + 0.3 * k);
    return [w, w * 1.15];
  }), 7));
  // the C-scroll: in from the top volute's eye, round and out, down the
  // front, and into the lower volute
  const pts = [];
  const spiral = (cd, cy, r0, r1, th0, th1, m) => {
    for (let i = 0; i <= m; i++) {
      const t = i / m, th = th0 + (th1 - th0) * t, r = r0 + (r1 - r0) * t;
      pts.push(P(cd + Math.cos(th) * r, cy + Math.sin(th) * r));
    }
  };
  spiral(0.2, -0.13, 0.025, 0.1, Math.PI * 2.6, 0, 30);
  pts.push(P(0.31, -0.24), P(0.29, -0.36), P(0.23, -0.46));
  spiral(0.15, -0.5, 0.075, 0.018, -0.4, -Math.PI * 2.5, 30);
  add(pts, 0.028, 0.018);
  add([P(0.015, 0.0), P(0.015, -0.3), P(0.015, -0.62)], 0.022, 0.016);
  add([P(0.0, -0.03), P(0.2, -0.03), P(0.36, -0.03)], 0.024, 0.02);
  return mergeGeometries(parts);
}
function mergeGeometries(gs) {
  const pos = [], nor = [], uv = [], idx = [];
  let off = 0;
  for (const g of gs) {
    pos.push(...g.attributes.position.array);
    nor.push(...g.attributes.normal.array);
    uv.push(...g.attributes.uv.array);
    for (const i of g.index.array) idx.push(i + off);
    off += g.attributes.position.count;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

function carpetTexture() {
  const s = 1024;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d');
  g.fillStyle = '#4a1210';
  g.fillRect(0, 0, s, s);
  g.translate(s / 2, s / 2);
  const ring = (r, w, col) => {
    g.strokeStyle = col;
    g.lineWidth = w;
    g.beginPath();
    g.arc(0, 0, r, 0, Math.PI * 2);
    g.stroke();
  };
  ring(s * 0.47, s * 0.05, '#2a0a08');
  ring(s * 0.44, 6, '#a07030');
  ring(s * 0.5 - 6, 6, '#a07030');
  ring(s * 0.36, 4, '#a07030');
  // a ring of medallions
  // (sixteen, under the feet of the dome's great and lesser ribs)
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2;
    g.save();
    g.rotate(a);
    g.fillStyle = k % 2 ? '#1e2a3a' : '#8a5a20';
    g.beginPath();
    g.ellipse(s * 0.4, 0, s * 0.022, s * 0.012, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }
  // a star in the middle
  g.fillStyle = '#7a4a18';
  g.beginPath();
  for (let i = 0; i < 32; i++) {
    const r = i % 2 ? s * 0.08 : s * 0.3;
    const a = (i / 32) * Math.PI * 2;
    g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
