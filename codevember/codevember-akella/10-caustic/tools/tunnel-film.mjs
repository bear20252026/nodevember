// node tools/tunnel-film.mjs [out.mp4]: records one loop of the tunnel (index.html), frame by frame, in headless Chromium with real
// WebGPU, and has ffmpeg make an mp4 of it. The page is opened with ?loop=<seconds>, which brings every motion in it
// to a whole number of turns in that time, so the last frame runs into the first.
// SIZE=1080 (square, or 1920x1080), LOOP=30 seconds, FPS=60, DPR=2 draws it finer and scales it down, CRF=16,
// SET='{"look":{...}}' changes settings, STILLS=8 writes that many pictures spread over the loop and no film.
import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
const [out = "output/tunnel-loop.mp4"] = process.argv.slice(2);
const [w, h = w] = (process.env.SIZE ?? "1080").split("x").map(Number);
const loop = +(process.env.LOOP ?? 30);
const fps = +(process.env.FPS ?? 60);
const dpr = +(process.env.DPR ?? 1);
const stills = +(process.env.STILLS ?? 0);
const base = os.homedir() + "/Library/Caches/ms-playwright/chromium-1243/";
const sub = fs.readdirSync(base).find((d) => d.startsWith("chrome-"));
const app = fs.readdirSync(base + sub).find((d) => d.endsWith(".app"));
const browser = await chromium.launch({ executablePath: `${base}${sub}/${app}/Contents/MacOS/${app.replace(".app", "")}`, headless: true });
const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: dpr });
const bad = [];
page.on("pageerror", (e) => bad.push(e.message.slice(0, 400)));
page.on("console", (m) => {
  if (["error", "warning"].includes(m.type()) && !m.text().includes("404")) bad.push(m.text().replace(/\s+/g, " ").slice(0, 400));
});
await page.goto(`${process.env.URL ?? "http://localhost:5310/"}?loop=${loop}`);
await page.waitForFunction(() => window.__tunnel && window.__tunnel.frame > 2, null, { timeout: 30000 }).catch(() => bad.push("never drew"));
if (process.env.SET)
  await page.evaluate((s) => {
    const g = window.__tunnel;
    const v = JSON.parse(s);
    for (const k of Object.keys(v)) Object.assign(g[k], v[k]);
  }, process.env.SET);
await page.addStyleTag({ content: ".lil-gui,body>div{display:none!important}" });
// (a few seconds first: the sand is baked, and what eases toward its place has got there)
await page.evaluate((s) => window.__tunnel.advance(s), +(process.env.FROM ?? 4));
const cdp = await page.context().newCDPSession(page);
const shot = async () => Buffer.from((await cdp.send("Page.captureScreenshot", { format: "png", optimizeForSpeed: true })).data, "base64");
fs.mkdirSync(out.split("/").slice(0, -1).join("/") || ".", { recursive: true });
const frames = Math.round(loop * fps);
const started = Date.now();
if (stills) {
  for (let k = 0; k < stills; k++) {
    fs.writeFileSync(out.replace(/\.\w+$/, `-${k}.png`), await shot());
    await page.evaluate((s) => window.__tunnel.advance(s), loop / stills);
  }
} else {
  const scale = `scale=${w}:${h}:flags=lanczos:out_color_matrix=bt709:out_range=tv`;
  const args = ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(fps), "-c:v", "png", "-i", "-", "-vf", scale, "-c:v", "libx264", "-preset", "slow", "-crf", process.env.CRF ?? "16"];
  args.push("-pix_fmt", "yuv420p", "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-movflags", "+faststart", out);
  const ff = spawn("ffmpeg", args, { stdio: ["pipe", "inherit", "inherit"] });
  const done = new Promise((resolve) => ff.on("close", resolve));
  for (let k = 0; k < frames; k++) {
    if (!ff.stdin.write(await shot())) await new Promise((r) => ff.stdin.once("drain", r));
    await page.evaluate((dt) => window.__tunnel.advance(dt), 1 / fps);
    if (k % 300 === 299) console.log(`${k + 1} of ${frames}, ${((Date.now() - started) / 1000).toFixed(0)} s`);
  }
  ff.stdin.end();
  await done;
  console.log(`${out}: ${frames} frames, ${(fs.statSync(out).size / 1e6).toFixed(1)} MB`);
}
console.log(bad.length ? `${bad.length} problems:\n${[...new Set(bad)].join("\n")}` : "clean");
await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 2500))]);
