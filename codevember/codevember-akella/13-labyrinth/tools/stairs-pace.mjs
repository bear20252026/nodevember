// node tools/stairs-pace.mjs [seconds] [WxH] : how evenly the stairs page's frames come while its light settles,
// and how fast it settles. SET='{"smooth":false}' changes look values.
import { chromium } from "playwright-core";
import fs from "node:fs";
import os from "node:os";
const [seconds = "8", size = "1600x1000"] = process.argv.slice(2);
const url = process.env.URL ?? "http://localhost:5313/";
const base = os.homedir() + "/Library/Caches/ms-playwright/chromium-1243/";
const sub = fs.readdirSync(base).find((d) => d.startsWith("chrome-"));
const app = fs.readdirSync(base + sub).find((d) => d.endsWith(".app"));
const browser = await chromium.launch({ executablePath: `${base}${sub}/${app}/Contents/MacOS/${app.replace(".app", "")}`, headless: process.env.HEAD ? false : true });
const [w, h] = size.split("x").map(Number);
const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: +(process.env.DPR ?? 1) });
const bad = [];
page.on("pageerror", (e) => bad.push(e.message.slice(0, 800)));
page.on("console", (m) => ["error", "warning"].includes(m.type()) && !m.text().includes("404") && bad.push(m.text().slice(0, 800)));
await page.goto(url);
await page.waitForFunction(() => window.__stairs && window.__stairs.state.frame > 2, null, { timeout: 60000 });
const out = await page.evaluate(
  ([s, ms]) =>
    new Promise((done) => {
      const r = window.__stairs;
      Object.assign(r.look, JSON.parse(s ?? "{}"));
      r.rebuild();
      const gaps = [];
      const log = [];
      let last = performance.now();
      const t0 = last;
      const tick = () => {
        const now = performance.now();
        gaps.push(now - last);
        last = now;
        if (gaps.length % 30 === 0) log.push(`${((now - t0) / 1000).toFixed(1)}s: ${r.state.samples} samples, ${r.state.rows} rows, band ${r.state.spent.toFixed(1)} ms of ${r.state.interval.toFixed(1)}`);
        if (now - t0 < ms) return requestAnimationFrame(tick);
        gaps.sort((a, b) => a - b);
        const at = (q) => gaps[Math.floor((gaps.length - 1) * q)].toFixed(1);
        done({ frames: gaps.length, fps: +(gaps.length / ((now - t0) / 1000)).toFixed(1), "median ms": at(0.5), "95% ms": at(0.95), "worst ms": at(1), "late frames": gaps.filter((g) => g > +at(0.5) * 1.5).length, samples: r.state.samples, log: log.filter((_, n) => n % 2 === 0) });
      };
      requestAnimationFrame(tick);
    }),
  [process.env.SET, +seconds * 1000],
);
console.log(JSON.stringify(out, null, 1), bad.length ? [...new Set(bad)].join("\n") : "");
await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 2500))]);
process.exit(0);
