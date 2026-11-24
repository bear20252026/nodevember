// node tools/cost.mjs [WxH] [moments ...]: how long the GPU takes to trace a frame at moments of the loop
// (milliseconds, settled). SET as in shot.mjs; DPR.
import { chromium } from "playwright-core";
import fs from "node:fs";
import os from "node:os";
const [size = "1280x720", ...shots] = process.argv.slice(2);
if (!shots.length)
  shots.push("0", "0.1", "0.2", "0.27", "0.4", "0.5", "0.69", "0.8", "0.95");
const url = process.env.URL ?? "http://localhost:5315/";
const base = os.homedir() + "/Library/Caches/ms-playwright/chromium-1243/";
const sub = fs.readdirSync(base).find((d) => d.startsWith("chrome-"));
const app = fs.readdirSync(base + sub).find((d) => d.endsWith(".app"));
const browser = await chromium.launch({
  executablePath: `${base}${sub}/${app}/Contents/MacOS/${app.replace(".app", "")}`,
  headless: true,
  args: [
    "--enable-features=WebGPU",
    "--enable-dawn-features=allow_unsafe_apis",
  ],
});
const [w, h] = size.split("x").map(Number);
const page = await browser.newPage({
  viewport: { width: w, height: h },
  deviceScaleFactor: +(process.env.DPR ?? 1),
});
page.on("pageerror", (e) => console.log(e.message.slice(0, 500)));
await page.goto(url);
await page.waitForFunction(
  () =>
    window.__mirage &&
    window.__mirage.state.skies > 0 &&
    window.__mirage.state.busy === 0,
  null,
  { timeout: 120000 },
);
await page.evaluate((set) => {
  const m = window.__mirage;
  const before = { ...m.look };
  Object.assign(m.look, JSON.parse(set ?? "{}"));
  for (const k of Object.keys(m.look))
    if (m.look[k] !== before[k]) m.changed(k);
}, process.env.SET);
await page.waitForTimeout(800);
const out = [];
for (const shot of shots) {
  await page.evaluate(
    (v) => ((window.__mirage.state.hold = v), (window.__mirage.state.ms = 0)),
    +shot,
  );
  await page.waitForTimeout(1500);
  const f0 = await page.evaluate(() => window.__mirage.state.frame);
  await page.waitForTimeout(2000);
  const [f1, ms] = await page.evaluate(() => [
    window.__mirage.state.frame,
    window.__mirage.state.ms,
  ]);
  out.push(`${shot}: ${ms.toFixed(1)} ms, ${((f1 - f0) / 2).toFixed(0)} fps`);
}
console.log(out.join("   "));
await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 2500))]);
process.exit(0);
