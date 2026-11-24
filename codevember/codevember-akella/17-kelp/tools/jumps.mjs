// node tools/jumps.mjs [WxH] [frames a loop]: does anything jump? Renders the whole loop a frame at a time (720 a
// loop unless told), with grain, shaft jitter and snow off, and counts the pixels that change a lot from each frame
// to the next. A thing that snaps from one place to another shows as a frame far above the rest.
// SET='{"sunSway":0}' changes look values first; URL picks the page.
import { chromium } from "playwright-core";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
const [size = "800x800", framesArg = "720"] = process.argv.slice(2);
const frames = +framesArg;
const base = os.homedir() + "/Library/Caches/ms-playwright/chromium-1243/";
const sub = fs.readdirSync(base).find((d) => d.startsWith("chrome-"));
const app = fs.readdirSync(base + sub).find((d) => d.endsWith(".app"));
const browser = await chromium.launch({ executablePath: `${base}${sub}/${app}/Contents/MacOS/${app.replace(".app", "")}`, headless: true });
const [w, h] = size.split("x").map(Number);
const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
page.on("pageerror", (e) => console.log(e.message.slice(0, 500)));
await page.goto(process.env.URL ?? "http://localhost:5317/");
await page.waitForFunction(() => window.__kelp && window.__kelp.state.frame > 2, null, { timeout: 90000 });
await page.addStyleTag({ content: ".lil-gui,canvas+div,body>div:not(:has(canvas)){display:none!important}" });
await page.evaluate((set) => {
  const r = window.__kelp;
  Object.assign(r.look, { film: 0, snow: 0 }, JSON.parse(set ?? "{}"));
  r.refresh();
  r.state.still = true;
}, process.env.SET);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "kelp-jumps-"));
const shot = async (at, name) => {
  await page.evaluate(
    (at) =>
      new Promise((done) => {
        window.__kelp.state.hold = at;
        let n = 0;
        const f = () => (++n < 3 ? requestAnimationFrame(f) : done());
        requestAnimationFrame(f);
      }),
    at,
  );
  const file = path.join(tmp, name + ".png");
  fs.writeFileSync(file, await page.screenshot());
  return file;
};
const steps = [];
let before = await shot(0, "f0");
for (let i = 1; i <= frames; i++) {
  const now = await shot((i % frames) / frames, "f" + (i & 1));
  // not the mean (one blade that snaps is lost in a picture where everything drifts) but how many pixels changed a lot
  steps.push({ at: i / frames, d: parseFloat(spawnSync("magick", ["compare", "-fuzz", "22%", "-metric", "AE", before, now, "null:"]).stderr.toString()) });
  before = now;
  // the two files take turns, so the one just compared against is not overwritten
  if (i & 1) fs.copyFileSync(now, path.join(tmp, "keep.png")), (before = path.join(tmp, "keep.png"));
}
const sorted = steps.map((s) => s.d).sort((a, b) => a - b);
const median = sorted[sorted.length >> 1];
const worst = [...steps].sort((a, b) => b.d - a.d).slice(0, 6);
console.log(`${frames} frames: pixels that change a lot from one frame to the next: ${median} (median), ${sorted[sorted.length - 1]} at most`);
console.log(`the biggest steps: ${worst.map((s) => `${s.d} at ${s.at.toFixed(4)}`).join(", ")}`);
console.log(`frames more than twice the median, and more than 150 over it: ${steps.filter((s) => s.d > 2 * median && s.d > median + 150).length}`);
await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 2500))]);
process.exit(0);
