// node tools/beams-shot.mjs <out.png> [WxH] [seconds to wait]: renders beams.html headless with real WebGPU, no flags.
// SET='{"plane":{"on":true},...}' changes settings; CAM="x,y,z,tx,ty,tz" places the camera (and stops the orbit);
// TIME=<s> holds the clock (for the pulse); BENCH=1 prints GPU ms per frame and per trace. DPR=2 for retina.
import { chromium } from "playwright-core";
import fs from "node:fs";
import os from "node:os";
const [out = "beams.png", size = "1280x720", wait = "1"] = process.argv.slice(2);
const url = process.env.URL ?? "http://localhost:5310/beams.html";
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
await page.waitForFunction(() => window.__beams && window.__beams.frame > 2, null, { timeout: 60000 }).catch(() => bad.push("never started"));
await page.evaluate(
  ({ set, cam, time }) => {
    const b = window.__beams;
    if (set) {
      const v = JSON.parse(set);
      for (const k of Object.keys(v)) Object.assign(b[k], v[k]);
    }
    if (cam) {
      const c = cam.split(",").map(Number);
      b.look.autoRotate = false;
      b.camera.position.set(c[0], c[1], c[2]);
      b.controls.target.set(c[3], c[4], c[5]);
      b.controls.enableDamping = false;
      b.controls.update();
    }
    if (time) {
      b.clock.time = +time;
      b.clock.hold = +time;
    }
    b.retrace();
  },
  { set: process.env.SET, cam: process.env.CAM, time: process.env.TIME },
);
await new Promise((r) => setTimeout(r, +wait * 1000));
await page.addStyleTag({ content: ".lil-gui,canvas+div,body>div:not(:has(canvas)){display:none!important}" });
fs.writeFileSync(out, await page.screenshot({ timeout: 60000 }));
if (process.env.BENCH) {
  const r = await page.evaluate(async () => ({ frame: await window.__beams.bench(20), trace: await window.__beams.traceBench() }));
  console.log(`gpu ms/frame ${r.frame.toFixed(2)}, one trace ${r.trace.toFixed(1)} ms`);
}
console.log(bad.length ? `${bad.length} problems:\n${[...new Set(bad)].join("\n")}` : "clean");
await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 2500))]);
process.exit(0);
