// CFG='[{"view":{...},"quad":{...},"hold":0.3}]' node tools/catastrophe-cost.mjs: integrand evaluations per texel (mean, median, 95th, max) and GPU ms/frame for each setting
import { chromium } from "playwright-core";
import fs from "node:fs";
import os from "node:os";
const base = os.homedir() + "/Library/Caches/ms-playwright/chromium-1243/";
const sub = fs.readdirSync(base).find((d) => d.startsWith("chrome-"));
const app = fs.readdirSync(base + sub).find((d) => d.endsWith(".app"));
const browser = await chromium.launch({ executablePath: `${base}${sub}/${app}/Contents/MacOS/${app.replace(".app", "")}`, headless: true });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
await page.goto("http://localhost:5310/catastrophe.html");
await page.waitForFunction(() => window.__catastrophe?.frame > 2);
for (const cfg of JSON.parse(process.env.CFG)) {
  const r = await page.evaluate(async (cfg) => {
    const c = window.__catastrophe;
    for (const k of Object.keys(cfg)) if (k !== "hold") Object.assign(c[k], cfg[k]);
    c.view.cost = true;
    c.clock.hold = cfg.hold ?? 0.3;
    await new Promise((r) => setTimeout(r, 300));
    const f = await c.readField();
    const e = [];
    for (let i = 0; i < f.W * f.H; i++) e.push(Math.round(f.data[2 * i] ** 2 * 400));
    e.sort((a, b) => a - b);
    c.view.cost = false;
    const ms = await c.bench(10);
    return { mean: e.reduce((a, b) => a + b, 0) / e.length, p50: e[e.length >> 1], p95: e[Math.floor(e.length * 0.95)], max: e[e.length - 1], ms };
  }, cfg);
  console.log(JSON.stringify(cfg), JSON.stringify(r));
}
await browser.close();
