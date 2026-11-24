// prints the bodies after a scripted run: THROW as in pool-shot, T=seconds
import { chromium } from "playwright-core";
import fs from "node:fs";
import os from "node:os";
const base = os.homedir() + "/Library/Caches/ms-playwright/chromium-1243/";
const sub = fs.readdirSync(base).find((d) => d.startsWith("chrome-"));
const app = fs.readdirSync(base + sub).find((d) => d.endsWith(".app"));
const browser = await chromium.launch({ executablePath: `${base}${sub}/${app}/Contents/MacOS/${app.replace(".app", "")}`, headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto("http://localhost:5310/pool.html");
await page.waitForFunction(() => window.__pool && window.__pool.frame > 2);
const throws = (process.env.THROW ?? "")
  .split(",")
  .filter(Boolean)
  .map((s) => {
    const [w, at] = s.split("@");
    const [kind, x, z] = w.split(":");
    return { kind, x: +x, z: +z, at: +at };
  });
let now = 0;
const T = +(process.env.T ?? 5);
const log = async () =>
  console.log(now.toFixed(2), JSON.stringify(await page.evaluate(() => window.__pool.bodies.filter((b) => b.kind !== "petal").map((b) => [b.kind, ...b.p.map((v) => +v.toFixed(3)), ...b.v.map((v) => +v.toFixed(2))]))));
for (const t of throws.sort((a, b) => a.at - b.at)) {
  await page.evaluate((s) => window.__pool.advance(s), t.at - now);
  now = t.at;
  await page.evaluate((t) => window.__pool.throwAt(t.kind, t.x, t.z), t);
}
while (now < T) {
  await page.evaluate((s) => window.__pool.advance(s), 0.25);
  now += 0.25;
  await log();
}
await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 2500))]);
