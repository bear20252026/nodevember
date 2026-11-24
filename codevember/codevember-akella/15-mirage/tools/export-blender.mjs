// node tools/export-blender.mjs: the world of a page as data, for blender/build.py: what stands where, the
// eye's place every frame, the sun, the doors' ways through, the sky's picture and the ground's height.
// URL (default the garden), FPS (30). Writes into blender/data/.
import { chromium } from "playwright-core";
import fs from "node:fs";
import os from "node:os";
const url = process.env.URL ?? "http://localhost:5315/";
const fps = +(process.env.FPS ?? 30);
// LAPS=0,2: a shorter loop through only those doors (each lap starts where every door leads, so any of them
// loop): only the eye's path is written, to data/path_<laps>.json, at the full loop's speed and lean
const laps = process.env.LAPS ? process.env.LAPS.split(",").map(Number) : null;
const out = new URL("../blender/data/", import.meta.url).pathname;
fs.mkdirSync(out, { recursive: true });
const base = os.homedir() + "/Library/Caches/ms-playwright/chromium-1243/";
const sub = fs.readdirSync(base).find((d) => d.startsWith("chrome-"));
const app = fs.readdirSync(base + sub).find((d) => d.endsWith(".app"));
const browser = await chromium.launch({ executablePath: `${base}${sub}/${app}/Contents/MacOS/${app.replace(".app", "")}`, headless: true });
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
page.on("pageerror", (e) => console.log(e.message.slice(0, 300)));
await page.goto(url);
await page.waitForFunction(() => window.__mirage && window.__mirage.state.skies > 0 && window.__mirage.state.busy === 0, null, { timeout: 120000 });

// Blender is z up: a point (x, y, z) here is (x, z, y) there (which also turns the left-handed way this page
// draws into Blender's right-handed one: the picture comes out the same way round)
if (laps) {
  const path = await page.evaluate(([fps, laps]) => {
    const m = window.__mirage;
    const w = m.world();
    const B = (v) => [v[0], v[2], v[1]];
    const full = w.length;
    w.laps = laps.map((k) => w.laps[k]);
    w.length = w.laps.reduce((t, l) => t + l.length, 0);
    // (the page's speed is all laps over 36 s, and the lean into turns goes with speed squared: keep both)
    m.look.bank *= (full / w.length) ** 2;
    const n = Math.round((36 * w.length * fps) / full);
    const frames = [];
    for (let f = 0; f < n; f++) {
      const p = m.pose(f / n);
      frames.push({ eye: B(p.eye), fore: B(p.fore), up: B(p.up), right: B(p.right), lap: p.lap });
    }
    return { loop: n / fps, fps, laps: w.laps.map((l) => ({ door: l.door, length: l.length })), frames };
  }, [fps, laps]);
  const name = `path_${laps.join("")}.json`;
  fs.writeFileSync(out + name, JSON.stringify(path));
  console.log(`${name}: ${path.frames.length} frames, ${path.loop.toFixed(2)} s, doors ${path.laps.map((l) => l.door)}`);
  await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 2500))]);
  process.exit(0);
}

const world = await page.evaluate((fps) => {
  const m = window.__mirage;
  const w = m.world();
  const L = m.look;
  const B = (v) => [v[0], v[2], v[1]];
  const loop = 36;
  const frames = [];
  for (let f = 0; f < loop * fps; f++) {
    const p = m.pose(f / (loop * fps));
    frames.push({ eye: B(p.eye), fore: B(p.fore), up: B(p.up), right: B(p.right), lap: p.lap });
  }
  const sunTurn = (L.sunTurn * Math.PI) / 180;
  const sunHigh = (L.sunHigh * Math.PI) / 180;
  const sun = [Math.sin(sunTurn) * Math.cos(sunHigh), Math.sin(sunHigh), Math.cos(sunTurn) * Math.cos(sunHigh)];
  // a door, gone through: a point p there is M p + o here, in Blender's axes (worked out from the page's own)
  const through = (g, p) => {
    const turn = -(g.face + Math.PI);
    const [c, s] = [Math.cos(turn), Math.sin(turn)];
    const [x, z] = [p[0] - g.x, p[2] - g.z];
    return [x * c + z * s, p[1] - g.ground + w.startGround, -x * s + z * c];
  };
  const glasses = w.glasses.map((g) => {
    const tall = g.h + g.ground - g.bottom;
    const out = { x: g.x, y: g.z, bottom: g.bottom, ground: g.ground, tall, width: g.w, face: g.face, door: g.door, normal: [Math.sin(g.face), Math.cos(g.face), 0] };
    if (g.door) {
      const o = B(through(g, [0, 0, 0]));
      const col = (e) => B(through(g, [e[0], e[2], e[1]])).map((v, i) => v - o[i]);
      out.portal = { matrix: [col([1, 0, 0]), col([0, 1, 0]), col([0, 0, 1])], offset: o };
    }
    return out;
  });
  return {
    loop,
    fps,
    look: { fov: L.fov, sunPower: L.sunPower, sunWide: L.sunWide, sandTone: L.sandTone, rockTone: L.rockTone, rim: L.rim, rimDepth: L.rimDepth, rimTone: L.rimTone, eye: L.eye, sight: L.sight, oasisWide: L.oasisWide, oasisGap: L.oasisGap, exposure: L.exposure },
    sun: B(sun),
    glasses,
    rocks: w.rocks.map((k) => ({ x: k.x, y: k.z, z: k.y, r: k.r, round: k.round, sunk: k.sunk, tone: k.tone })),
    laps: w.laps.map((l) => ({ door: l.door, length: l.length })),
    ends: m.state.ends,
    startGround: w.startGround,
    oasis: { x: w.oasis.x, y: w.oasis.z, ground: w.oasis.ground },
    frames,
  };
}, fps);
fs.writeFileSync(out + "world.json", JSON.stringify(world));
console.log(`world: ${world.glasses.length} glasses, ${world.rocks.length} rocks, ${world.frames.length} frames`);

// the ground: three grids, each finer one cut out of the next coarser (see build.py)
const grids = [
  { name: "near", x0: -90, z0: -70, nx: 1201, nz: 2201, texel: 0.15 },
  { name: "mid", x0: -800, z0: -600, nx: 1601, nz: 1601, texel: 1 },
  { name: "far", x0: -6000, z0: -5000, nx: 751, nz: 751, texel: 16 },
];
for (const g of grids) {
  const b64 = await page.evaluate((g) => window.__mirage.groundGrid(g.x0, g.z0, g.nx, g.nz, g.texel), g);
  fs.writeFileSync(out + `ground_${g.name}.f32`, Buffer.from(b64, "base64"));
  console.log(`ground ${g.name}: ${g.nx} x ${g.nz} at ${g.texel} m`);
}
fs.writeFileSync(out + "grids.json", JSON.stringify(grids));
const sky = await page.evaluate(() => window.__mirage.skyPicture());
fs.writeFileSync(out + "sky.f16", Buffer.from(sky, "base64"));
console.log("sky: 4096 x 1536 rgba half floats");
await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 2500))]);
process.exit(0);
