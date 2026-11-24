// node tools/shot.mjs <out.png> [WxH] [seconds to wait]: renders the page headless with real WebGPU, no flags.
// AT=t1,t2,... seeks the show to each time (seconds) and writes out-<t>.png for each.
// SET='{"flow":{...},"water":{...}}' changes settings first. DPR=2 for a retina canvas. STIR=1 drags across the middle.
import { chromium } from "playwright-core";
import fs from "node:fs";
import os from "node:os";
const [out = "shot.png", size = "1280x720", wait = "1"] = process.argv.slice(2);
const url = process.env.URL ?? "http://localhost:5310/creatures.html";
const base = os.homedir() + "/Library/Caches/ms-playwright/chromium-1243/";
const sub = fs.readdirSync(base).find((d) => d.startsWith("chrome-"));
const app = fs.readdirSync(base + sub).find((d) => d.endsWith(".app"));
const browser = await chromium.launch({ executablePath: `${base}${sub}/${app}/Contents/MacOS/${app.replace(".app", "")}`, headless: true });
const [w, h] = size.split("x").map(Number);
const page = await browser.newPage({ viewport: { width: w, height: h ?? w }, deviceScaleFactor: +(process.env.DPR ?? 1) });
const bad = [];
page.on("pageerror", (e) => bad.push(e.message.slice(0, 400)));
page.on("console", (m) => {
  if (["error", "warning"].includes(m.type()) && !m.text().includes("404")) bad.push(m.text().replace(/\s+/g, " ").slice(0, 400));
  if (process.env.LOG && m.type() === "log") console.log("page:", m.text());
});
await page.goto(url);
await page.waitForFunction(() => window.__caustic?.world?.ready.every(Boolean), null, { timeout: 60000 }).catch(() => bad.push("never ready"));
if (process.env.SET)
  await page.evaluate((s) => {
    const c = window.__caustic;
    const v = JSON.parse(s);
    for (const k of Object.keys(v)) Object.assign(c[k], v[k]);
    c.writeWaves();
  }, process.env.SET);
await page.addStyleTag({ content: ".lil-gui,canvas+div,body>div:not(:has(canvas)){display:none!important}" });
const info = await page.evaluate(() => ({ world: window.__caustic.world, loop: window.__caustic.loopLength() }));
console.log(JSON.stringify(info));
const times = process.env.AT ? process.env.AT.split(",").map(Number) : [null];
for (const t of times) {
  if (t !== null) {
    const t0 = performance.now();
    await page.evaluate((t) => window.__caustic.seek(t), t);
    if (process.env.STIR)
      await page.evaluate(async (count) => {
        const c = window.__caustic;
        c.clock.seeking = true;
        // a drag left to right across the middle, a frame at a time
        // the held clock is stepped by hand, so the show moves on 1/60 s a frame while the cursor drags
        const t0 = c.clock.hold;
        const frames = +count || 20;
        for (let k = 0; k < frames; k++) {
          if (k < 20) c.stir(-0.6 + k * 0.06, 0.05 * Math.sin(k * 0.5), 0.06, 0.02);
          c.clock.hold = t0 + (k + 1) / 60;
          c.step(c.clock.hold, 1 / 60);
          await new Promise((r) => requestAnimationFrame(r));
        }
        c.clock.seeking = false;
      }, process.env.STIR);
    console.log(`seek ${t}: ${(performance.now() - t0).toFixed(0)} ms`, JSON.stringify(await page.evaluate(() => window.__caustic.phase)));
  }
  await new Promise((r) => setTimeout(r, +wait * 1000));
  const name = t === null ? out : out.replace(/\.png$/, `-${t}.png`);
  fs.writeFileSync(name, await page.screenshot({ timeout: 60000 }));
}
if (process.env.BENCH) console.log("gpu ms/frame", (await page.evaluate(() => window.__caustic.bench(30))).toFixed(2));
console.log(bad.length ? `${bad.length} problems:\n${[...new Set(bad)].join("\n")}` : "clean");
await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 2500))]);
process.exit(0);
