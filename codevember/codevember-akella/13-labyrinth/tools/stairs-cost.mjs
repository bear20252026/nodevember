// node tools/stairs-cost.mjs (SAMPLES=16 to time it once the light is done) : what the stairs page costs at retina size (1512x900 at 2x): the display pass on the
// graphics card, frames a second, and samples of light made, with the people, without them, and without their shade.
import { chromium } from "playwright-core";
import fs from "node:fs";
import os from "node:os";
const base = os.homedir() + "/Library/Caches/ms-playwright/chromium-1243/";
const sub = fs.readdirSync(base).find((d) => d.startsWith("chrome-"));
const app = fs.readdirSync(base + sub).find((d) => d.endsWith(".app"));
const browser = await chromium.launch({ executablePath: `${base}${sub}/${app}/Contents/MacOS/${app.replace(".app", "")}`, headless: true });
for (const [name, set, skip] of [["as it is", {}, {}], ["no people", { walkers: 0, sitters: 0 }, {}], ["figures, no shade", {}, { shade: true }], ["shade, no figures", {}, { people: true }]]) {
  const page = await browser.newPage({ viewport: { width: 1512, height: 900 }, deviceScaleFactor: 2 });
  await page.goto("http://localhost:5313/");
  await page.waitForFunction(() => window.__stairs && window.__stairs.state.frame > 2, null, { timeout: 60000 });
  const out = await page.evaluate(([set, skip, want]) => new Promise((done) => {
    const r = window.__stairs;
    Object.assign(r.look, { samples: want || r.look.samples }, set);
    Object.assign(r.state.skip, skip);
    r.rebuild();
    const t0 = performance.now();
    const f0 = r.state.frame;
    r.state.shown = 0;
    // (with SAMPLES set, timed only once the light is done, so that the showing is all there is)
    let settled = 0;
    const wait = () => (want && r.state.samples < r.look.samples ? requestAnimationFrame(wait) : !settled++ ? ((r.state.shown = 0), requestAnimationFrame(wait)) : performance.now() - t0 > 6000 ? done({ shown: r.state.shown.toFixed(2), fps: (((r.state.frame - f0) * 1000) / (performance.now() - t0)).toFixed(0), people: r.state.people, samples: r.state.samples }) : requestAnimationFrame(wait));
    wait();
  }), [set, skip, +(process.env.SAMPLES ?? 0)]);
  console.log(name.padEnd(18), "display pass", out.shown, "ms on the GPU,", out.fps, "fps,", out.samples, "samples in 6 s,", out.people, "likenesses");
  await page.close();
}
await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 2500))]);
process.exit(0);
