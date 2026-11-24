// node tools/film.mjs <out.mp4> [WxH=1024x1024] [fps=30] [loops=1]: the loop as a film, frame by frame from the page
// held at each moment, so no frame is dropped. SET='{"film":0}' changes look values; URL; DPR=2 draws it twice the
// size and brings it down, for cleaner edges; CRF. The loop is F sim frames at 60 a second (an even number): fps 30
// holds every second one, so the last frame leads exactly back to the first.
import { chromium } from "playwright-core";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
const [out = "pendulum.mp4", size = "1024x1024", fps = "30", loops = "1"] = process.argv.slice(2);
const url = process.env.URL ?? "http://localhost:5318/";
const base = os.homedir() + "/Library/Caches/ms-playwright/chromium-1243/";
const sub = fs.readdirSync(base).find((d) => d.startsWith("chrome-"));
const app = fs.readdirSync(base + sub).find((d) => d.endsWith(".app"));
const browser = await chromium.launch({ executablePath: `${base}${sub}/${app}/Contents/MacOS/${app.replace(".app", "")}`, headless: true });
const [w, h] = size.split("x").map(Number);
const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: +(process.env.DPR ?? 1) });
await page.goto(url);
await page.waitForFunction(() => window.__pendulum && window.__pendulum.state.frame > 2, null, { timeout: 90000 });
await page.addStyleTag({ content: ".lil-gui,.balls,#stats,canvas+div,body>div:not(:has(canvas)){display:none!important}" });
const F = await page.evaluate((s) => {
  const r = window.__pendulum;
  if (s) Object.assign(r.look, JSON.parse(s));
  r.refresh();
  r.frameUp();
  return r.F;
}, process.env.SET);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pendulum-film-"));
const step = 60 / +fps;
const n = F / step;
const t0 = Date.now();
for (let i = 0; i < n; i++) {
  await page.evaluate(
    (at) =>
      new Promise((done) => {
        const r = window.__pendulum;
        r.state.hold = at;
        const f0 = r.state.frame;
        const f = () => (r.state.frame - f0 < 3 ? requestAnimationFrame(f) : done(0));
        requestAnimationFrame(f);
      }),
    i / n,
  );
  fs.writeFileSync(path.join(tmp, `f${String(i).padStart(4, "0")}.png`), await page.screenshot({ timeout: 60000 }));
  if (i % 60 === 59) console.log(`${i + 1}/${n} frames, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}
await browser.close();
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-stream_loop", String(+loops - 1), "-framerate", fps, "-i", path.join(tmp, "f%04d.png"), "-vf", `scale=${w}:${h}:flags=lanczos`, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", process.env.CRF ?? "16", "-preset", "slow", "-movflags", "+faststart", out]);
fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
fs.rmSync(tmp, { recursive: true });
console.log(`${out}: ${(fs.statSync(out).size / 1e6).toFixed(1)} MB, ${n * +loops} frames at ${fps} fps`);
