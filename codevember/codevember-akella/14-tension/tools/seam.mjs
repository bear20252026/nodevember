// node tools/seam.mjs [periods]: how far the sheet at each period's start is from the one before (FEED=0 to switch the pull off)
import { chromium } from "playwright-core";
import fs from "node:fs";
import os from "node:os";
const periods = +(process.argv[2] ?? 4);
const base = os.homedir() + "/Library/Caches/ms-playwright/chromium-1243/";
const sub = fs.readdirSync(base).find((d) => d.startsWith("chrome-"));
const app = fs.readdirSync(base + sub).find((d) => d.endsWith(".app"));
const browser = await chromium.launch({ executablePath: `${base}${sub}/${app}/Contents/MacOS/${app.replace(".app", "")}`, headless: true });
const page = await browser.newPage({ viewport: { width: 320, height: 240 } });
page.on("pageerror", (e) => console.log("error", e.message));
await page.goto(process.env.URL ?? "http://localhost:5314/");
await page.waitForFunction(() => window.__cloth && window.__cloth.state.frame > 2, null, { timeout: 120000 });
const out = await page.evaluate(
  async ([periods, feed]) => {
    const r = window.__cloth;
    r.state.pause = true;
    if (feed !== null) r.state.feed = feed;
    const F = Math.round((r.period ?? 20) / (1 / 60));
    const device = r.renderer.backend.device;
    const lines = [];
    let prev = null;
    let mid = null;
    for (let p = 0; p <= periods; p++) {
      while (r.state.f < p * F) {
        r.tick();
        if (r.state.f % 30 === 0) await device.queue.onSubmittedWorkDone();
      }
      const { pos } = await r.sim.read();
      if (prev) {
        let worst = 0,
          sum = 0;
        for (let i = 0; i < pos.length; i += 4) {
          const d = Math.hypot(pos[i] - prev[i], pos[i + 1] - prev[i + 1], pos[i + 2] - prev[i + 2]);
          worst = Math.max(worst, d);
          sum += d * d;
        }
        lines.push(`period ${p}: worst ${(worst * 1000).toFixed(3)} mm, rms ${(Math.sqrt(sum / (pos.length / 4)) * 1000).toFixed(3)} mm`);
      }
      prev = pos;
    }
    // and the step from the last frame to the first: one more frame against a normal frame's step
    return lines;
  },
  [periods, process.env.FEED === undefined ? null : +process.env.FEED],
);
console.log(out.join("\n"));
await browser.close();
