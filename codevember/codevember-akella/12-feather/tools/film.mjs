// node tools/film.mjs <outdir> [WxH] [from playhead] [frames]: steps the playhead one 60 fps frame at a time and
// saves numbered PNGs, then an mp4 next to them if ffmpeg is there. CLIP="x,y,w,h" crops; EVERY=n keeps every
// nth frame; SET='{"shed":0}' changes look values; VIEW="az,el,dist[,tx,ty,tz]" pins the camera (otherwise it drifts as on the page).
import { chromium } from "playwright-core";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
const [out = "film", size = "1000x750", from = "0.125", count = "120"] = process.argv.slice(2);
const url = process.env.URL ?? "http://localhost:5312/";
const base = os.homedir() + "/Library/Caches/ms-playwright/chromium-1243/";
const sub = fs.readdirSync(base).find((d) => d.startsWith("chrome-"));
const app = fs.readdirSync(base + sub).find((d) => d.endsWith(".app"));
const browser = await chromium.launch({ executablePath: `${base}${sub}/${app}/Contents/MacOS/${app.replace(".app", "")}`, headless: true });
const [w, h] = size.split("x").map(Number);
const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
const bad = [];
page.on("pageerror", (e) => bad.push(e.message.slice(0, 400)));
page.on("console", (m) => {
  if (["error", "warning"].includes(m.type()) && !m.text().includes("404")) bad.push(m.text().replace(/\s+/g, " ").slice(0, 400));
});
await page.goto(url);
await page.waitForFunction(() => window.__feather && window.__feather.state.frame > 2, null, { timeout: 90000 });
await page.addStyleTag({ content: ".lil-gui,canvas+div,body>div:not(:has(canvas)){display:none!important}" });
if (process.env.SET)
  await page.evaluate((v) => {
    Object.assign(window.__feather.look, JSON.parse(v));
    window.__feather.refresh();
  }, process.env.SET);
fs.mkdirSync(out, { recursive: true });
const clip = process.env.CLIP ? Object.fromEntries(process.env.CLIP.split(",").map((v, i) => [["x", "y", "width", "height"][i], +v])) : undefined;
const every = +(process.env.EVERY ?? 1);
const frames = +count;
const loopFrames = 12 * 60; // 12 s loop at 60 fps
const view = process.env.VIEW ? process.env.VIEW.split(",").map(Number) : null;
const step = (p) =>
  page.evaluate(
    ([p, view]) =>
      new Promise((done) => {
        const r = window.__feather;
        r.state.hold = p;
        r.state.view = view;
        const f0 = r.state.frame;
        const wait = () => (r.state.frame > f0 + 1 ? done() : requestAnimationFrame(wait));
        requestAnimationFrame(wait);
      }),
    [p, view],
  );
let n = 0;
for (let i = 0; i < frames; i++) {
  await step((+from + i / loopFrames) % 1);
  if (i % every) continue;
  fs.writeFileSync(`${out}/f${String(n++).padStart(4, "0")}.png`, await page.screenshot({ clip }));
}
try {
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(60 / every), "-i", `${out}/f%04d.png`, "-pix_fmt", "yuv420p", "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2", `${out}.mp4`]);
} catch (e) {
  bad.push("ffmpeg: " + e.message.slice(0, 200));
}
console.log(`${n} frames`, bad.length ? `${bad.length} problems:\n${[...new Set(bad)].join("\n")}` : "clean");
await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 2500))]);
process.exit(0);
