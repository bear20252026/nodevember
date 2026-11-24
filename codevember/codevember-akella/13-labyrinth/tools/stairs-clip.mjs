// node tools/stairs-clip.mjs <dir> [WxH] [frames] [from] [to] : frames of the stairs page between two moments of
// the loop (0..1), as dir/0000.png..., once its light has settled. SET, CENTRE, DPR, URL, TURN as in stairs-shot.mjs.
import { chromium } from "playwright-core";
import fs from "node:fs";
import os from "node:os";
const [dir = "clip", size = "800x500", frames = "48", from = "0", to = "0.1"] = process.argv.slice(2);
const url = process.env.URL ?? "http://localhost:5313/";
const base = os.homedir() + "/Library/Caches/ms-playwright/chromium-1243/";
const sub = fs.readdirSync(base).find((d) => d.startsWith("chrome-"));
const app = fs.readdirSync(base + sub).find((d) => d.endsWith(".app"));
const browser = await chromium.launch({ executablePath: `${base}${sub}/${app}/Contents/MacOS/${app.replace(".app", "")}`, headless: true });
const [w, h] = size.split("x").map(Number);
const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: +(process.env.DPR ?? 1) });
page.on("pageerror", (e) => console.log(e.message.slice(0, 600)));
await page.goto(url);
await page.waitForFunction(() => window.__stairs && window.__stairs.state.frame > 2, null, { timeout: 60000 });
await page.addStyleTag({ content: ".lil-gui,canvas+div,body>div:not(:has(canvas)){display:none!important}" });
await page.evaluate(([s, c, t]) => {
  const r = window.__stairs;
  Object.assign(r.look, { smooth: false, samples: 96, ...JSON.parse(s ?? "{}") });
  if (c) (r.centre[0] = c[0]), (r.centre[1] = c[1]);
  if (t) (r.turned[0] = t[0]), (r.turned[1] = t[1]);
  r.rebuild();
}, [process.env.SET, process.env.CENTRE ? process.env.CENTRE.split(",").map(Number) : null, process.env.TURN ? process.env.TURN.split(",").map(Number) : null]);
await page.waitForFunction(() => window.__stairs.state.samples >= window.__stairs.look.samples, null, { timeout: 300000 });
fs.mkdirSync(dir, { recursive: true });
for (let n = 0; n < +frames; n++) {
  await page.evaluate((hold) => new Promise((done) => ((window.__stairs.state.hold = hold), requestAnimationFrame(() => requestAnimationFrame(done)))), +from + ((+to - +from) * n) / +frames);
  fs.writeFileSync(`${dir}/${String(n).padStart(4, "0")}.png`, await page.screenshot());
}
console.log(`${frames} frames in ${dir}`);
await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 2500))]);
process.exit(0);
