import { chromium } from "playwright-core";
import fs from "node:fs";
import os from "node:os";
const base = os.homedir() + "/Library/Caches/ms-playwright/chromium-1243/";
const sub = fs.readdirSync(base).find((d) => d.startsWith("chrome-"));
const app = fs.readdirSync(base + sub).find((d) => d.endsWith(".app"));
const browser = await chromium.launch({ executablePath: `${base}${sub}/${app}/Contents/MacOS/${app.replace(".app", "")}`, headless: true });
const [w, h] = (process.env.SIZE ?? "1280x720").split("x").map(Number);
const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: +(process.env.DPR ?? 1) });
await page.goto("http://localhost:5310/pool.html");
await page.waitForFunction(() => window.__pool && window.__pool.frame > 2);
await page.evaluate(async () => {
  const g = window.__pool;
  for (const [k, x, z] of [
    ["ball", -0.5, 0.2],
    ["stone", 0.4, -0.3],
    ["marble", 0.1, 0.4],
    ["petal", 0.8, 0.3],
    ["ball", 0.9, -0.5],
    ["stone", -0.3, -0.5],
    ["marble", -0.9, 0.3],
  ])
    g.throwAt(k, x, z);
  await g.advance(2);
});
if (process.env.EMPTY) await page.evaluate(() => window.__pool.bodies.splice(0));
console.log("bodies", await page.evaluate(() => window.__pool.bodies.length));
for (const skip of (process.env.SKIPS ?? "0,1,2,4,8,16,32,63").split(",").map(Number)) {
  const ms = await page.evaluate(async (s) => {
    window.__pool.dbg.skip = s;
    return window.__pool.bench(30);
  }, skip);
  console.log("skip", skip, ms.toFixed(2));
}
await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 2500))]);
