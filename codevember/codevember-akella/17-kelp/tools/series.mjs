// node tools/series.mjs [WxH] [dpr] [seconds] ['<look json>']: ms a frame of the free running page, every 30 frames
// from the moment it starts, to see a cost that comes on with time. URL as in shot.mjs.
import { chromium } from "playwright-core";
import fs from "node:fs";
import os from "node:os";
const [size = "800x500", dpr = "1", seconds = "6", set = "{}"] = process.argv.slice(2);
const base = os.homedir() + "/Library/Caches/ms-playwright/chromium-1243/";
const sub = fs.readdirSync(base).find((d) => d.startsWith("chrome-"));
const app = fs.readdirSync(base + sub).find((d) => d.endsWith(".app"));
const browser = await chromium.launch({ executablePath: `${base}${sub}/${app}/Contents/MacOS/${app.replace(".app", "")}`, headless: true, args: ["--disable-gpu-vsync", "--disable-frame-rate-limit"] });
const [w, h] = size.split("x").map(Number);
const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: +dpr });
page.on("pageerror", (e) => console.log(e.message.slice(0, 500)));
await page.goto(process.env.URL ?? "http://localhost:5317/");
await page.waitForFunction(() => window.__kelp && window.__kelp.state.frame > 2, null, { timeout: 90000 });
const out = await page.evaluate(
  async ([seconds, set]) => {
    const r = window.__kelp;
    const { __state = {}, ...rest } = JSON.parse(set);
    Object.assign(r.state, __state);
    Object.assign(r.look, rest);
    r.refresh();
    const q = r.renderer.backend.device.queue;
    const rows = [];
    const start = performance.now();
    while (performance.now() - start < seconds * 1000) {
      await q.onSubmittedWorkDone();
      const f0 = r.state.frame,
        t0 = performance.now();
      while (r.state.frame - f0 < 30) await new Promise((ok) => requestAnimationFrame(ok));
      await q.onSubmittedWorkDone();
      rows.push([((t0 - start) / 1000).toFixed(2), ((performance.now() - t0) / (r.state.frame - f0)).toFixed(2), r.state.frame]);
    }
    return rows;
  },
  [+seconds, set],
);
console.log(out.map((r) => `${r[0]}s ${r[1]}ms f${r[2]}`).join("  |  "));
await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 2500))]);
process.exit(0);
