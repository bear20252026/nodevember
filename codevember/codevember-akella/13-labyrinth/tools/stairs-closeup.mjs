// node tools/stairs-closeup.mjs <dir> <figure id> <frames> <from> <to> : follows a figure at zoom 4, frames of the loop between two moments.
// UPRIGHT=0 goes to it and lets go, leaving the world unturned (so its gravity shows)
import { chromium } from "playwright-core";
import fs from "node:fs";
import os from "node:os";
const [dir, id, frames = "40", from = "0", to = "0.02"] = process.argv.slice(2);
const base = os.homedir() + "/Library/Caches/ms-playwright/chromium-1243/";
const sub = fs.readdirSync(base).find((d) => d.startsWith("chrome-"));
const app = fs.readdirSync(base + sub).find((d) => d.endsWith(".app"));
const browser = await chromium.launch({ executablePath: `${base}${sub}/${app}/Contents/MacOS/${app.replace(".app", "")}`, headless: true });
const page = await browser.newPage({ viewport: { width: 700, height: 700 }, deviceScaleFactor: 1 });
page.on("pageerror", (e) => console.log(e.message.slice(0, 400)));
await page.goto("http://localhost:5313/");
await page.waitForFunction(() => window.__stairs && window.__stairs.state.frame > 2, null, { timeout: 60000 });
await page.addStyleTag({ content: ".lil-gui,canvas+div,body>div:not(:has(canvas)){display:none!important}" });
await page.evaluate(() => { const r = window.__stairs; Object.assign(r.look, { smooth: false, samples: 96, drift: 0 }); r.rebuild(); });
await page.waitForFunction(() => window.__stairs.state.samples >= window.__stairs.look.samples, null, { timeout: 300000 });
await page.evaluate((id) => { const r = window.__stairs; r.state.hold = 0; r.eye.follow = +id; r.eye.zoomAim = 4; }, id);
fs.mkdirSync(dir, { recursive: true });
for (let n = 0; n < +frames; n++) {
  await page.evaluate((hold) => { window.__stairs.state.hold = hold; }, +from + ((+to - +from) * n) / +frames);
  await page.waitForTimeout(n === 0 ? 3000 : 700);
  if (n === 0 && process.env.UPRIGHT === "0") {
    await page.evaluate(() => { const r = window.__stairs; r.eye.follow = -1; r.eye.aim = 0; r.eye.zoomAim = 4; });
    await page.waitForTimeout(2500);
  }
  fs.writeFileSync(`${dir}/${String(n).padStart(4, "0")}.png`, await page.screenshot());
}
console.log("done");
await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 2500))]);
process.exit(0);
