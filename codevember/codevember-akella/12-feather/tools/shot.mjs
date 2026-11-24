// node tools/shot.mjs <out.png> [WxH] [shots]: renders the page headless with real WebGPU and tiles the shots.
// shots is a list like "0.05@40,-15,3.6 0.3@40,-15" : playhead @ camera azimuth,elevation[,distance] (degrees;
// azimuth from the bird's right round to its nose, negative elevation looks up from below). No camera = the drift.
// SET='{"through":0.4}' changes look values, MOTION='{"lag":0}' the flight; EVAL runs js once at the start, PROBE after each shot is posed; DPR; COLS for the sheet.
import { chromium } from "playwright-core";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
const [out = "shot.png", size = "900x600", ...shots] = process.argv.slice(2);
if (!shots.length) shots.push("0.1");
const url = process.env.URL ?? "http://localhost:5312/";
const base = os.homedir() + "/Library/Caches/ms-playwright/chromium-1243/";
const sub = fs.readdirSync(base).find((d) => d.startsWith("chrome-"));
const app = fs.readdirSync(base + sub).find((d) => d.endsWith(".app"));
const browser = await chromium.launch({ executablePath: `${base}${sub}/${app}/Contents/MacOS/${app.replace(".app", "")}`, headless: true });
const [w, h] = size.split("x").map(Number);
const page = await browser.newPage({ viewport: { width: w, height: h ?? w }, deviceScaleFactor: +(process.env.DPR ?? 1) });
const bad = [];
page.on("pageerror", (e) => bad.push(e.message.slice(0, 600)));
page.on("console", (m) => {
  if (["error", "warning"].includes(m.type()) && !m.text().includes("404")) bad.push(m.text().replace(/\s+/g, " ").slice(0, 600));
  if (m.text().startsWith("heron")) console.log(m.text());
});
await page.goto(url);
await page.waitForFunction(() => window.__feather && window.__feather.state.frame > 2, null, { timeout: 60000 }).catch(() => bad.push("never started"));
await page.addStyleTag({ content: ".lil-gui,canvas+div,body>div:not(:has(canvas)){display:none!important}" });
await page.evaluate(
  ([s, m]) => {
    const r = window.__feather;
    if (!r) return;
    if (s) Object.assign(r.look, JSON.parse(s));
    if (m) Object.assign(r.motion, JSON.parse(m));
    r.refresh();
  },
  [process.env.SET, process.env.MOTION],
);
if (process.env.EVAL) console.log(JSON.stringify(await page.evaluate(process.env.EVAL)));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "feather-"));
const files = [];
let fps = 0;
for (const [i, shot] of shots.entries()) {
  const [at, cam] = shot.split("@");
  fps = await page.evaluate(
    ([at, cam]) =>
      new Promise((done) => {
        const r = window.__feather;
        if (!r) return done(0);
        r.state.hold = +at;
        r.state.view = cam ? cam.split(",").map(Number) : null;
        let n = 0;
        const f0 = r.state.frame;
        const t0 = performance.now();
        const f = () => (++n < 12 ? requestAnimationFrame(f) : done((r.state.frame - f0) / ((performance.now() - t0) / 1000)));
        requestAnimationFrame(f);
      }),
    [at, cam],
  );
  if (process.env.PROBE) console.log(JSON.stringify(await page.evaluate(process.env.PROBE)));
  const file = path.join(tmp, `s${String(i).padStart(2, "0")}.png`);
  fs.writeFileSync(file, await page.screenshot({ timeout: 60000 }));
  files.push(file);
}
if (files.length === 1) fs.copyFileSync(files[0], out);
else execFileSync("montage", [...files, "-tile", `${process.env.COLS ?? Math.ceil(Math.sqrt(files.length))}x`, "-geometry", "+2+2", "-background", "#222", out]);
console.log(`fps ${fps.toFixed(1)}`, bad.length ? `${bad.length} problems:\n${[...new Set(bad)].join("\n")}` : "clean");
await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 2500))]);
process.exit(0);
