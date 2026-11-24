// node tools/shot.mjs <out.png> [WxH] [phases...]: renders the page headless with real WebGPU and tiles the shots.
// SET='{"sun":3}' changes look values; EVAL runs js once at the start; DPR; COLS for the sheet; URL.
import { chromium } from "playwright-core";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
const [out = "shot.png", size = "1280x720", ...shots] = process.argv.slice(2);
if (!shots.length) shots.push("0.1");
const url = process.env.URL ?? "http://localhost:5316/";
const base = os.homedir() + "/Library/Caches/ms-playwright/chromium-1243/";
const sub = fs.readdirSync(base).find((d) => d.startsWith("chrome-"));
const app = fs.readdirSync(base + sub).find((d) => d.endsWith(".app"));
const browser = await chromium.launch({
  executablePath: `${base}${sub}/${app}/Contents/MacOS/${app.replace(".app", "")}`,
  headless: true,
});
const [w, h] = size.split("x").map(Number);
const page = await browser.newPage({
  viewport: { width: w, height: h ?? w },
  deviceScaleFactor: +(process.env.DPR ?? 1),
});
const bad = [];
page.on("pageerror", (e) => bad.push(e.message.slice(0, 1500)));
page.on("console", (m) => {
  const t = m.text();
  if (t.startsWith("spore:")) console.log(t);
  if (["error", "warning"].includes(m.type()) && !t.includes("404"))
    bad.push(t.replace(/[ \t]+/g, " ").slice(0, 1500));
});
const t0 = Date.now();
await page.goto(url);
await page
  .waitForFunction(
    () => window.__spore && window.__spore.state.frame > 2,
    null,
    { timeout: 90000 },
  )
  .catch(() => bad.push("never started"));
console.log(`started in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
await page.addStyleTag({
  content:
    ".lil-gui,canvas+div,body>div:not(:has(canvas)){display:none!important}",
});
await page.evaluate((s) => {
  const r = window.__spore;
  if (!r || !s) return;
  Object.assign(r.look, JSON.parse(s));
  r.refresh();
  r.frameUp();
}, process.env.SET);
if (process.env.EVAL)
  console.log(JSON.stringify(await page.evaluate(process.env.EVAL)));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "spore-"));
const files = [];
let fps = 0;
for (const [i, at] of shots.entries()) {
  fps = await page.evaluate(
    (at) =>
      new Promise((done) => {
        const r = window.__spore;
        r.state.hold = +at;
        let n = 0;
        const f0 = r.state.frame;
        const t0 = performance.now();
        const f = () =>
          ++n < 8
            ? requestAnimationFrame(f)
            : done((r.state.frame - f0) / ((performance.now() - t0) / 1000));
        requestAnimationFrame(f);
      }),
    at,
  );
  const file = path.join(tmp, `s${String(i).padStart(2, "0")}.png`);
  fs.writeFileSync(file, await page.screenshot({ timeout: 60000 }));
  files.push(file);
}
if (files.length === 1) fs.copyFileSync(files[0], out);
else
  execFileSync("montage", [
    ...files,
    "-tile",
    `${process.env.COLS ?? Math.ceil(Math.sqrt(files.length))}x`,
    "-geometry",
    "+2+2",
    "-background",
    "#222",
    out,
  ]);
console.log(
  `fps ${fps.toFixed(1)}`,
  bad.length
    ? `${bad.length} problems:\n${[...new Set(bad)].join("\n")}`
    : "clean",
);
await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 2500))]);
process.exit(0);
