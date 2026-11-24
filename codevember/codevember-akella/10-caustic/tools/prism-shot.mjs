// node tools/prism-shot.mjs <out.png> [WxH] [seconds to wait]: renders prism.html headless with real WebGPU, no flags.
// AT=0.1,0.4 holds the loop at those points (0..1) and writes out-<t>.png for each.
// SET='{"knot":{...},"light":{...},"look":{...}}' changes settings first; CAM="x,y,z,tx,ty,tz" places the camera.
// DPR=2 for a retina canvas, BENCH=1 prints GPU ms per frame.
import { chromium } from "playwright-core";
import fs from "node:fs";
import os from "node:os";
const [out = "prism.png", size = "1280x720", wait = "0.5"] = process.argv.slice(2);
const url = process.env.URL ?? "http://localhost:5310/prism.html";
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
});
await page.goto(url);
await page.waitForFunction(() => window.__prism?.frame > 2, null, { timeout: 60000 }).catch(() => bad.push("never started"));
if (process.env.SET)
  await page.evaluate((s) => {
    const p = window.__prism;
    const v = JSON.parse(s);
    for (const k of Object.keys(v)) Object.assign(p[k], v[k]);
    p.writeBands();
  }, process.env.SET);
const cam = process.env.CAM?.split(",").map(Number);
if (cam)
  await page.evaluate((c) => {
    const p = window.__prism;
    p.camera.position.set(c[0], c[1], c[2]);
    p.controls.target.set(c[3], c[4], c[5]);
    p.controls.update();
  }, cam);
await page.addStyleTag({ content: ".lil-gui,canvas+div,body>div:not(:has(canvas)){display:none!important}" });
const times = process.env.AT ? process.env.AT.split(",").map(Number) : [null];
for (const t of times) {
  if (t !== null)
    await page.evaluate((t) => {
      window.__prism.play.playing = false;
      window.__prism.play.t = t;
    }, t);
  await new Promise((r) => setTimeout(r, +wait * 1000));
  const name = t === null ? out : out.replace(/\.png$/, `-${t}.png`);
  fs.writeFileSync(name, await page.screenshot({ timeout: 60000 }));
}
if (process.env.BENCH) console.log("gpu ms/frame", (await page.evaluate(() => window.__prism.bench(20))).toFixed(2));
console.log(bad.length ? `${bad.length} problems:\n${[...new Set(bad)].join("\n")}` : "clean");
await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 2500))]);
process.exit(0);
