// node tools/cost.mjs [WxH] [dpr] '<look json>' ...: milliseconds a frame of the free running page, for each set of
// look values in turn (one page load). URL as in shot.mjs. `__state` in a set goes to the page's state.
import { chromium } from "playwright-core";
import fs from "node:fs";
import os from "node:os";
const [size = "1600x1000", dpr = "2", ...sets] = process.argv.slice(2);
if (!sets.length) sets.push("{}");
const base = os.homedir() + "/Library/Caches/ms-playwright/chromium-1243/";
const sub = fs.readdirSync(base).find((d) => d.startsWith("chrome-"));
const app = fs.readdirSync(base + sub).find((d) => d.endsWith(".app"));
const browser = await chromium.launch({ executablePath: `${base}${sub}/${app}/Contents/MacOS/${app.replace(".app", "")}`, headless: true, args: ["--disable-gpu-vsync", "--disable-frame-rate-limit"] });
const [w, h] = size.split("x").map(Number);
const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: +dpr });
page.on("pageerror", (e) => console.log(e.message.slice(0, 500)));
try {
  await page.goto(process.env.URL ?? "http://localhost:5317/");
  await page.waitForFunction(() => window.__kelp && window.__kelp.state.frame > 2, null, { timeout: 90000 });
  const keep = await page.evaluate(() => JSON.stringify(window.__kelp.look));
  // the first seconds read too fast: frames are handed over faster than the GPU finishes them, until it pushes back
  await page.evaluate(async () => {
    const r = window.__kelp;
    const f0 = r.state.frame;
    while (r.state.frame - f0 < 400) await new Promise((ok) => requestAnimationFrame(ok));
    await r.renderer.backend.device.queue.onSubmittedWorkDone();
  });
  for (const set of sets) {
    const ms = await Promise.race([
      page.evaluate(
        async ([keep, set]) => {
          const r = window.__kelp;
          const { __state = {}, ...rest } = JSON.parse(set);
          Object.assign(r.state, { skipLight: false }, __state);
          Object.assign(r.look, JSON.parse(keep), rest);
          r.refresh();
          r.frameUp();
          await new Promise((ok) => setTimeout(ok, 600));
          const q = r.renderer.backend.device.queue;
          await q.onSubmittedWorkDone();
          const f0 = r.state.frame,
            t0 = performance.now();
          while (r.state.frame - f0 < 150) await new Promise((ok) => requestAnimationFrame(ok));
          await q.onSubmittedWorkDone();
          return (performance.now() - t0) / (r.state.frame - f0);
        },
        [keep, set],
      ),
      new Promise((ok) => setTimeout(() => ok(NaN), 60000)),
    ]);
    console.log(`${ms.toFixed(1).padStart(6)} ms  ${set}`);
  }
} catch (e) {
  console.log(String(e).slice(0, 400));
}
await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 2500))]);
process.exit(0);
