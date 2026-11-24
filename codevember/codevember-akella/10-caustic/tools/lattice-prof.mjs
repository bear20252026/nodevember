// prints the lattice's frame time and mesh size: SIZE=WxH, DPR=2 for retina, SET='{"lattice":{...}}'
import { chromium } from "playwright-core";
import fs from "node:fs";
import os from "node:os";
const base = os.homedir() + "/Library/Caches/ms-playwright/chromium-1243/";
const sub = fs.readdirSync(base).find((d) => d.startsWith("chrome-"));
const app = fs.readdirSync(base + sub).find((d) => d.endsWith(".app"));
const browser = await chromium.launch({ executablePath: `${base}${sub}/${app}/Contents/MacOS/${app.replace(".app", "")}`, headless: true });
const [w, h] = (process.env.SIZE ?? "1280x720").split("x").map(Number);
const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: +(process.env.DPR ?? 1) });
await page.goto("http://localhost:5310/lattice.html");
await page.waitForFunction(() => window.__lattice && window.__lattice.frame > 2);
if (process.env.SET)
  await page.evaluate((s) => {
    const v = JSON.parse(s);
    for (const k of Object.keys(v)) Object.assign(window.__lattice[k], v[k]);
  }, process.env.SET);
await page.evaluate(() => window.__lattice.advance(0.1));
await page.waitForFunction(() => window.__lattice.ready, null, { timeout: 60000 });
await page.evaluate(() => window.__lattice.advance(1));
const ms = await page.evaluate(() => window.__lattice.bench(30));
console.log(`${w}x${h}@${process.env.DPR ?? 1}`, "gpu ms/frame", ms.toFixed(2), JSON.stringify(await page.evaluate(() => window.__lattice.mesh)));
await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 2500))]);
