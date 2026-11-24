// node tools/trails.mjs <out.png> [WxH] [from] [to] [count]: what moves, as trails. Renders `count` moments of the
// loop from `from` to `to` and keeps the brightest of them at every pixel, so a bright thing on dark water leaves a
// row of itself: how far apart they are is how fast it goes, and a kink in the row is a jerk. SET, URL, DPR as in
// shot.mjs.
import { chromium } from "playwright-core";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
const [out = "trails.png", size = "1600x1000", from = "0", to = "0.2", count = "20"] = process.argv.slice(2);
const base = os.homedir() + "/Library/Caches/ms-playwright/chromium-1243/";
const sub = fs.readdirSync(base).find((d) => d.startsWith("chrome-"));
const app = fs.readdirSync(base + sub).find((d) => d.endsWith(".app"));
const browser = await chromium.launch({ executablePath: `${base}${sub}/${app}/Contents/MacOS/${app.replace(".app", "")}`, headless: true });
const [w, h] = size.split("x").map(Number);
const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: +(process.env.DPR ?? 1) });
page.on("pageerror", (e) => console.log(e.message.slice(0, 800)));
await page.goto(process.env.URL ?? "http://localhost:5317/");
await page.waitForFunction(() => window.__kelp && window.__kelp.state.frame > 2, null, { timeout: 90000 });
await page.addStyleTag({ content: ".lil-gui,canvas+div,body>div:not(:has(canvas)){display:none!important}" });
await page.evaluate((s) => {
  const r = window.__kelp;
  Object.assign(r.look, { film: 0 }, JSON.parse(s ?? "{}"));
  r.refresh();
  r.frameUp();
}, process.env.SET);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "kelp-trails-"));
const files = [];
for (let i = 0; i < +count; i++) {
  const at = +from + ((+to - +from) * i) / Math.max(1, +count - 1);
  await page.evaluate(
    (at) =>
      new Promise((done) => {
        window.__kelp.state.hold = at;
        let n = 0;
        const f = () => (++n < 6 ? requestAnimationFrame(f) : done());
        requestAnimationFrame(f);
      }),
    at,
  );
  const file = path.join(tmp, `t${String(i).padStart(3, "0")}.png`);
  fs.writeFileSync(file, await page.screenshot({ timeout: 60000 }));
  files.push(file);
}
execFileSync("magick", [...files, "-evaluate-sequence", "max", out]);
fs.rmSync(tmp, { recursive: true });
console.log(`${files.length} moments from ${from} to ${to}: ${((+to - +from) / Math.max(1, +count - 1)).toFixed(4)} of a loop apart`);
await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 2500))]);
process.exit(0);
