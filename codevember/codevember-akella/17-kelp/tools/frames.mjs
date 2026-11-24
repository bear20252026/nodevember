// node tools/frames.mjs <out.png> <from> <count> <step> <WxH+X+Y>: one small part of the picture at moments that
// follow each other, side by side: for a thing that jitters, which a still cannot show and a trail smears.
// The crop is in pixels of a 1600x1000 page at DPR 2. `step` in loops (a frame of the 12 s loop is 0.001389).
// SET, URL, COLS as in shot.mjs.
import { chromium } from "playwright-core";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
const [out = "frames.png", from = "0", count = "8", step = "0.001389", crop = "800x600+1200+700"] = process.argv.slice(2);
const base = os.homedir() + "/Library/Caches/ms-playwright/chromium-1243/";
const sub = fs.readdirSync(base).find((d) => d.startsWith("chrome-"));
const app = fs.readdirSync(base + sub).find((d) => d.endsWith(".app"));
const browser = await chromium.launch({ executablePath: `${base}${sub}/${app}/Contents/MacOS/${app.replace(".app", "")}`, headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 });
page.on("pageerror", (e) => console.log(e.message.slice(0, 800)));
await page.goto(process.env.URL ?? "http://localhost:5317/");
await page.waitForFunction(() => window.__kelp && window.__kelp.state.frame > 2, null, { timeout: 90000 });
await page.addStyleTag({ content: ".lil-gui,canvas+div,body>div:not(:has(canvas)){display:none!important}" });
await page.evaluate((s) => {
  const r = window.__kelp;
  Object.assign(r.look, { film: 0, snow: 0 }, JSON.parse(s ?? "{}"));
  r.refresh();
  r.frameUp();
  r.state.still = true;
}, process.env.SET);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "kelp-frames-"));
const files = [];
for (let i = 0; i < +count; i++) {
  await page.evaluate(
    (at) =>
      new Promise((done) => {
        window.__kelp.state.hold = at;
        let n = 0;
        const f = () => (++n < 5 ? requestAnimationFrame(f) : done());
        requestAnimationFrame(f);
      }),
    +from + i * +step,
  );
  const file = path.join(tmp, `q${String(i).padStart(3, "0")}.png`);
  fs.writeFileSync(file, await page.screenshot());
  execFileSync("magick", [file, "-crop", crop, "+repage", file]);
  files.push(file);
}
execFileSync("montage", [...files, "-tile", `${process.env.COLS ?? count}x`, "-geometry", "+2+2", "-background", "#222", out]);
fs.rmSync(tmp, { recursive: true });
await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 2500))]);
process.exit(0);
