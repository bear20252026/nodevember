// node tools/seam.mjs [WxH]: is the last frame next to the first? Renders pairs of frames 1/960 of the loop apart,
// across the seam and elsewhere, with grain and shaft jitter off, and prints how much each pair differs (0..255).
// The pair across the seam should differ like the others do.
import { chromium } from "playwright-core";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
const [size = "1280x800"] = process.argv.slice(2);
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
await page.evaluate(() => {
  const r = window.__kelp;
  Object.assign(r.look, { film: 0 });
  r.refresh();
  r.state.still = true;
});
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "kelp-seam-"));
const shot = async (at, name) => {
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
  const file = path.join(tmp, name + ".png");
  fs.writeFileSync(file, await page.screenshot());
  return file;
};
const step = 1 / 960;
for (const [name, a, b] of [
  ["across the seam", 1 - step / 2, step / 2],
  ["a quarter in", 0.25 - step / 2, 0.25 + step / 2],
  ["half way", 0.5 - step / 2, 0.5 + step / 2],
  ["as a blade is born", 1 / 13 - step / 2, 1 / 13 + step / 2],
  ["the same frame twice", 0.37, 0.37],
  ["whole loop apart", 0, 0.99999999],
]) {
  const fa = await shot(a, "a"),
    fb = await shot(b, "b");
  // compare writes its number to stderr, and exits 1 when the pictures differ
  const metric = (m) => parseFloat(spawnSync("magick", ["compare", "-metric", m, fa, fb, "null:"]).stderr.toString()) / 257;
  const mean = metric("MAE"),
    peak = metric("PAE");
  console.log(`${name.padEnd(22)} mean ${mean.toFixed(4)}  worst pixel ${peak.toFixed(1)}`);
}
await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 2500))]);
process.exit(0);
