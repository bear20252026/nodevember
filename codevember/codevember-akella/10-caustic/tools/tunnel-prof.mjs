// node tools/tunnel-prof.mjs: what each pass of the tunnel (index.html) costs, by leaving it out. The runs are interleaved and
// the least of several taken, since another tab on the same GPU makes any one run noisy. SIZE=1440x810 DPR=2.
import { chromium } from "playwright-core";
import fs from "node:fs";
import os from "node:os";
const base = os.homedir() + "/Library/Caches/ms-playwright/chromium-1243/";
const sub = fs.readdirSync(base).find((d) => d.startsWith("chrome-"));
const app = fs.readdirSync(base + sub).find((d) => d.endsWith(".app"));
const browser = await chromium.launch({ executablePath: `${base}${sub}/${app}/Contents/MacOS/${app.replace(".app", "")}`, headless: true });
const [w, h] = (process.env.SIZE ?? "1440x810").split("x").map(Number);
const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: +(process.env.DPR ?? 1) });
page.on("console", (m) => m.type() === "error" && console.log(m.text().slice(0, 300)));
await page.goto(process.env.URL ?? "http://localhost:5310/");
await page.waitForFunction(() => window.__tunnel && window.__tunnel.frame > 2, null, { timeout: 30000 });
const out = await page.evaluate(async () => {
  const g = window.__tunnel;
  await g.advance(0.3);
  const names = ["all", ...Object.keys(g.skip)];
  const best = Object.fromEntries(names.map((n) => [n, 1e9]));
  for (let round = 0; round < 6; round++) {
    for (const n of names) {
      for (const k of Object.keys(g.skip)) g.skip[k] = k === n;
      best[n] = Math.min(best[n], await g.bench(12));
    }
  }
  for (const k of Object.keys(g.skip)) g.skip[k] = false;
  return names.map((n) => (n === "all" ? `all ${best.all.toFixed(2)} ms` : `${n} ${(best.all - best[n]).toFixed(2)}`)).join(", ");
});
console.log(out);
await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 2500))]);
