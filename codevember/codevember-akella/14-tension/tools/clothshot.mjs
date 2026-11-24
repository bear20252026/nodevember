// node tools/clothshot.mjs <out.png> [WxH] [seconds...]: renders the cloth (index.html) headless with real WebGPU at
// those sim times (run on in order, unseen in between) and tiles the shots.
// SET='{"sun":3}' changes look; PHYS='{"bend":10}' changes physics (then restarts); EVAL; DPR; COLS; URL; N
import { chromium } from "playwright-core";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
const [out = "cloth.png", size = "1280x720", ...shots] = process.argv.slice(2);
if (!shots.length) shots.push("0");
const url = process.env.URL ?? `http://localhost:5314/?${process.env.Q ?? ""}`;
const base = os.homedir() + "/Library/Caches/ms-playwright/chromium-1243/";
const sub = fs.readdirSync(base).find((d) => d.startsWith("chrome-"));
const app = fs.readdirSync(base + sub).find((d) => d.endsWith(".app"));
const browser = await chromium.launch({ executablePath: `${base}${sub}/${app}/Contents/MacOS/${app.replace(".app", "")}`, headless: true });
const [w, h] = size.split("x").map(Number);
const page = await browser.newPage({ viewport: { width: w, height: h ?? w }, deviceScaleFactor: +(process.env.DPR ?? 1) });
const bad = [];
page.on("pageerror", (e) => bad.push(e.message.slice(0, 1500)));
page.on("console", (m) => {
  const t = m.text();
  if (t.startsWith("cloth")) console.log(t);
  if (["error", "warning"].includes(m.type()) && !t.includes("404")) bad.push(t.replace(/[ \t]+/g, " ").slice(0, 1500));
});
const t0 = Date.now();
await page.goto(url);
await page.waitForFunction(() => window.__cloth && window.__cloth.state.frame > 2, null, { timeout: 120000 }).catch(() => bad.push("never started"));
console.log(`started in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
await page.addStyleTag({ content: ".lil-gui,canvas+div,body>div:not(:has(canvas)),#cloth-editor,div[style*='z-index: 10000']{display:none!important}" });
await page.evaluate(
  ([s, p]) => {
    const r = window.__cloth;
    if (s) Object.assign(r.look, JSON.parse(s));
    if (p) {
      Object.assign(r.physics, JSON.parse(p));
      r.sim.reset();
      for (let k = 0; k < r.state.warm * 60; k++) r.sim.advance(1 / 60, r.pushersAt(0), false);
      r.state.t = 0;
      r.state.f = 0;
    }
    r.refresh(true);
  },
  [process.env.SET, process.env.PHYS],
);
if (process.env.EVAL) console.log(JSON.stringify(await page.evaluate(process.env.EVAL)));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cloth-"));
const files = [];
for (const [i, at] of shots.entries()) {
  const ms = await page.evaluate(async (at) => {
    const r = window.__cloth;
    r.state.pause = true;
    const device = r.renderer.backend.device;
    let n = 0;
    const t0 = performance.now();
    while (r.state.t < at - 1e-6) {
      r.tick();
      if (++n % 30 === 0) await device.queue.onSubmittedWorkDone();
    }
    await device.queue.onSubmittedWorkDone();
    const ms = n ? (performance.now() - t0) / n : 0;
    await new Promise((done) => {
      let k = 0;
      const f = () => (++k < 4 ? requestAnimationFrame(f) : done());
      requestAnimationFrame(f);
    });
    return ms;
  }, +at);
  console.log(`t ${at}: sim ${ms.toFixed(2)} ms/frame`);
  const file = path.join(tmp, `s${String(i).padStart(2, "0")}.png`);
  fs.writeFileSync(file, await page.screenshot({ timeout: 60000 }));
  files.push(file);
}
if (files.length === 1) fs.copyFileSync(files[0], out);
else execFileSync("montage", [...files, "-tile", `${process.env.COLS ?? Math.min(files.length, 3)}x`, "-geometry", "+2+2", "-background", "#222", out]);
if (bad.length) console.log("problems:\n" + [...new Set(bad)].slice(0, 12).join("\n"));
await browser.close();
