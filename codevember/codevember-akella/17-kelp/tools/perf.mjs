// node tools/perf.mjs [WxH] [dpr]: frames a second of the free running page at a real size, and what turning
// each part of the picture off gives back. SET='{"blur":0}' as in shot.mjs.
import { chromium } from "playwright-core";
import fs from "node:fs";
import os from "node:os";
const [size = "1600x1000", dpr = "2"] = process.argv.slice(2);
const base = os.homedir() + "/Library/Caches/ms-playwright/chromium-1243/";
const sub = fs.readdirSync(base).find((d) => d.startsWith("chrome-"));
const app = fs.readdirSync(base + sub).find((d) => d.endsWith(".app"));
const browser = await chromium.launch({ executablePath: `${base}${sub}/${app}/Contents/MacOS/${app.replace(".app", "")}`, headless: true, args: ["--disable-gpu-vsync", "--disable-frame-rate-limit"] });
const [w, h] = size.split("x").map(Number);
const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: +dpr });
page.on("pageerror", (e) => console.log(e.message.slice(0, 500)));
await page.goto(process.env.URL ?? "http://localhost:5317/");
await page.waitForFunction(() => window.__kelp && window.__kelp.state.frame > 2, null, { timeout: 90000 });
const run = (set) =>
  page.evaluate(
    (set) =>
      new Promise((done) => {
        const r = window.__kelp;
        const keep = { ...r.look };
        const { __state = {}, ...rest } = set;
        Object.assign(r.state, { skipPose: false, skipLight: false }, __state);
        Object.assign(r.look, rest);
        r.refresh();
        // count frames the GPU has actually finished, not frames handed to it
        setTimeout(async () => {
          const q = r.renderer.backend.device.queue;
          await q.onSubmittedWorkDone();
          const f0 = r.state.frame,
            t0 = performance.now();
          while (r.state.frame - f0 < 90) await new Promise((ok) => requestAnimationFrame(ok));
          await q.onSubmittedWorkDone();
          const fps = (r.state.frame - f0) / ((performance.now() - t0) / 1000);
          Object.assign(r.look, keep);
          r.refresh();
          done([fps, r.state.ms]);
        }, 500);
      }),
    set,
  );
const base0 = JSON.parse(process.env.SET ?? "{}");
for (const [name, set] of [
  ["as it is", {}],
  ["plant not posed", { __state: { skipPose: true } }],
  ["sun map not drawn", { __state: { skipLight: true } }],
  ["neither", { __state: { skipPose: true, skipLight: true } }],
  ["no bloom", { bloom: 0 }],
]) {
  const [fps, ms] = await run({ ...base0, ...set });
  console.log(`${name.padEnd(14)} ${fps.toFixed(1)} fps (${(1000 / fps).toFixed(1)} ms), pose ${(ms ?? 0).toFixed(1)} ms`);
}
await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 2500))]);
process.exit(0);
