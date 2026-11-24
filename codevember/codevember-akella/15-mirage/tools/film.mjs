// node tools/film.mjs <dir> [size]: the loop, frame by frame, as PNGs into <dir> (f_0000.png ...), headless with
// real WebGPU, each moment held (so traced in full, never cut back by the pacing) and drawn twice before it is
// taken. size is the picture's (default 1024x1024); DPR (default 2) draws it that many times finer, for
// ffmpeg to shrink back (four rays to a pixel at 2). LAPS=0,2: a shorter loop through only those doors (any of
// them loop: every lap starts where every door leads), at the full loop's speed and lean. FPS (30), FROM / TO
// (frames, to do part of it), SET as in shot.mjs, URL.
import { chromium } from "playwright-core";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
const [dir = "film", size = "1024x1024"] = process.argv.slice(2);
const url = process.env.URL ?? "http://localhost:5315/";
const fps = +(process.env.FPS ?? 30);
const dpr = +(process.env.DPR ?? 2);
const laps = process.env.LAPS ? process.env.LAPS.split(",").map(Number) : null;
fs.mkdirSync(dir, { recursive: true });
const base = os.homedir() + "/Library/Caches/ms-playwright/chromium-1243/";
const sub = fs.readdirSync(base).find((d) => d.startsWith("chrome-"));
const app = fs.readdirSync(base + sub).find((d) => d.endsWith(".app"));
const browser = await chromium.launch({
  executablePath: `${base}${sub}/${app}/Contents/MacOS/${app.replace(".app", "")}`,
  headless: true,
});
const [w, h] = size.split("x").map(Number);
const page = await browser.newPage({ viewport: { width: w, height: h ?? w }, deviceScaleFactor: dpr });
page.on("pageerror", (e) => console.log("page error:", e.message.slice(0, 500)));
await page.goto(url);
await page.waitForFunction(() => window.__mirage && window.__mirage.state.frame > 2, null, { timeout: 120000 });
await page.addStyleTag({ content: ".lil-gui,body>div{display:none!important}" });

const n = await page.evaluate(
  ([laps, fps, set, pixels]) => {
    const m = window.__mirage;
    Object.assign(m.look, JSON.parse(set ?? "{}"));
    for (const k of Object.keys(JSON.parse(set ?? "{}"))) m.changed(k);
    // (the page traces at most `detail` megapixels and shows them stretched: a film is traced at its full size)
    m.look.detail = Math.max(m.look.detail, pixels / 1e6 + 0.01);
    const w = m.world();
    const full = w.length;
    if (laps) {
      w.laps = laps.map((k) => w.laps[k]);
      w.length = w.laps.reduce((t, l) => t + l.length, 0);
      // (the page's speed is all its laps over 36 s, and the lean into turns goes with speed squared)
      m.look.bank *= (full / w.length) ** 2;
    }
    return Math.round((36 * w.length * fps) / full);
  },
  [laps, fps, process.env.SET, w * (h ?? w) * dpr * dpr],
);
const from = +(process.env.FROM ?? 0);
const to = Math.min(n, +(process.env.TO ?? n));
console.log(`${n} frames (${(n / fps).toFixed(2)} s), doing ${from}..${to - 1} at ${w * dpr}x${(h ?? w) * dpr}`);
await page.waitForFunction(() => window.__mirage.state.skies > 0 && window.__mirage.state.busy === 0, null, {
  timeout: 180000,
});
const t0 = Date.now();
for (let f = from; f < to; f++) {
  const file = path.join(dir, `f_${String(f).padStart(4, "0")}.png`);
  if (fs.existsSync(file)) continue;
  const f0 = await page.evaluate((v) => {
    window.__mirage.state.hold = v;
    return window.__mirage.state.frame;
  }, f / n);
  // (two frames drawn at this moment: the first may have been under way when it was set)
  await page.waitForFunction((f0) => window.__mirage.state.frame > f0 + 1, f0, { timeout: 60000 });
  fs.writeFileSync(file, await page.screenshot({ timeout: 60000 }));
  if (f % 60 === 0) console.log(`frame ${f}, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}
const st = await page.evaluate(() => window.__mirage.state);
console.log(`done in ${((Date.now() - t0) / 1000).toFixed(0)} s; traced at scale ${st.scale}`);
await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 2500))]);
process.exit(0);
