// node tools/shot.mjs <out.png> [WxH] [playhead 0..1]: renders the page headless with real WebGPU (no flags).
// SET='{"span":2}' changes look values; CAM="x,y,z" moves the camera; DPR sets the pixel ratio.
import { chromium } from "playwright-core";
import fs from "node:fs";
import os from "node:os";
const [out = "shot.png", size = "1200x900", at = "0.5"] = process.argv.slice(2);
const url = process.env.URL ?? "http://localhost:5311/";
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
  if (m.text().startsWith("bake")) console.log(m.text());
});
if (process.env.FLAGS) await page.addInitScript((f) => Object.assign(window, JSON.parse(f)), process.env.FLAGS);
await page.goto(url);
await page.waitForFunction(() => window.__rust && window.__rust.state.frame > 2, null, { timeout: 90000 }).catch(() => bad.push("never started"));
await page.evaluate(
  ([s, at, cam]) => {
    const r = window.__rust;
    if (s) Object.assign(r.look, JSON.parse(s));
    r.refresh();
    r.state.hold = +at;
    if (cam) {
      const c = cam.split(",").map(Number);
      r.camera.position.set(c[0], c[1], c[2]);
      r.controls.update();
    }
  },
  [process.env.SET, at, process.env.CAM],
);
if (process.env.EVAL) await page.evaluate(process.env.EVAL);
await page.addStyleTag({ content: ".lil-gui,canvas+div,body>div:not(:has(canvas)){display:none!important}" });
const info = await page.evaluate(
  () =>
    new Promise((r) => {
      let n = 0;
      const f0 = window.__rust.state.frame;
      const t0 = performance.now();
      const f = () => {
        if (++n < 40) requestAnimationFrame(f);
        else r({ fps: (window.__rust.state.frame - f0) / ((performance.now() - t0) / 1000) });
      };
      requestAnimationFrame(f);
    }),
);
fs.writeFileSync(out, await page.screenshot({ timeout: 60000 }));
console.log(`fps ${info.fps.toFixed(1)}`, bad.length ? `${bad.length} problems:\n${[...new Set(bad)].join("\n")}` : "clean");
await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 2500))]);
process.exit(0);
