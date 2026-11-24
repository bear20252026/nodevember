// node tools/film.mjs <out.mp4> [WxH=720x1280] [fps=30] [loops=1]: the loop as a film, frame by frame from the page
// held at each moment, so no frame is dropped. SET='{"film":0}' changes look values; URL; DPR=2 draws it twice the
// size and brings it down, for cleaner edges; CRF.
import { chromium } from "playwright-core";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
const [out = "spore.mp4", size = "720x1280", fps = "30", loops = "1"] = process.argv.slice(2);
const url = process.env.URL ?? "http://localhost:5316/";
const base = os.homedir() + "/Library/Caches/ms-playwright/chromium-1243/";
const sub = fs.readdirSync(base).find((d) => d.startsWith("chrome-"));
const app = fs.readdirSync(base + sub).find((d) => d.endsWith(".app"));
const browser = await chromium.launch({ executablePath: `${base}${sub}/${app}/Contents/MacOS/${app.replace(".app", "")}`, headless: true });
const [w, h] = size.split("x").map(Number);
const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: +(process.env.DPR ?? 1) });
await page.goto(url);
await page.waitForFunction(() => window.__spore && window.__spore.state.frame > 2, null, { timeout: 90000 });
await page.addStyleTag({ content: ".lil-gui,canvas+div,body>div:not(:has(canvas)){display:none!important}" });
const T = 12;
await page.evaluate((s) => {
  const r = window.__spore;
  if (s) Object.assign(r.look, JSON.parse(s));
  r.refresh();
  r.frameUp();
}, process.env.SET);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "spore-film-"));
const n = Math.round(T * +fps);
const t0 = Date.now();
for (let i = 0; i < n; i++) {
  await page.evaluate(
    (at) =>
      new Promise((done) => {
        const r = window.__spore;
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
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-stream_loop", String(+loops - 1), "-framerate", fps, "-i", path.join(tmp, "f%04d.png"), "-vf", `scale=${w}:${h}:flags=lanczos`, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", process.env.CRF ?? "20", "-preset", "slow", "-movflags", "+faststart", out]);
fs.rmSync(tmp, { recursive: true });
console.log(`${out}: ${(fs.statSync(out).size / 1e6).toFixed(1)} MB, ${n * +loops} frames at ${fps} fps`);
