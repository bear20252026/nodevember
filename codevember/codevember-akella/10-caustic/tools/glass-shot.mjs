// node tools/glass-shot.mjs <out.png> [WxH]: renders glass.html headless with real WebGPU, no flags.
// POSES='eye:0:0:0,eye:12:0:0' (picture:tilt deg:spin deg:lift) places the slab for each shot, writes out-<k>.png.
// FRAMES=n frames to converge each (default 90). SET='{"lens":{...}}' changes settings. BENCH=1 prints GPU ms/frame.
// SHOW=t1,t2 instead holds the automatic show at those seconds (after letting it run up to them).
import { chromium } from "playwright-core";
import fs from "node:fs";
import os from "node:os";
const [out = "glass.png", size = "1280x720"] = process.argv.slice(2);
const url = process.env.URL ?? "http://localhost:5310/glass.html";
const base = os.homedir() + "/Library/Caches/ms-playwright/chromium-1243/";
const sub = fs.readdirSync(base).find((d) => d.startsWith("chrome-"));
const app = fs.readdirSync(base + sub).find((d) => d.endsWith(".app"));
const browser = await chromium.launch({ executablePath: `${base}${sub}/${app}/Contents/MacOS/${app.replace(".app", "")}`, headless: true });
const [w, h] = size.split("x").map(Number);
const page = await browser.newPage({ viewport: { width: w, height: h ?? w }, deviceScaleFactor: +(process.env.DPR ?? 1) });
const bad = [];
page.on("pageerror", (e) => bad.push(e.message.slice(0, 400)));
page.on("console", (m) => {
  if (["error", "warning"].includes(m.type()) && !m.text().includes("404")) bad.push(m.text().replace(/\s+/g, " ").slice(0, 400));
  if (m.type() === "log" && m.text().startsWith("glass")) console.log(m.text());
});
await page.goto(url);
await page.waitForFunction(() => window.__glass?.ready, null, { timeout: 90000 }).catch(() => bad.push("never ready"));
if (process.env.SET)
  await page.evaluate((s) => {
    const g = window.__glass;
    const v = JSON.parse(s);
    for (const k of Object.keys(v)) Object.assign(g[k], v[k]);
  }, process.env.SET);
await page.addStyleTag({ content: ".lil-gui,canvas+div,body>div:not(:has(canvas)){display:none!important}" });
const frames = +(process.env.FRAMES ?? 90);
const shots = [];
if (process.env.SHOW) {
  for (const t of process.env.SHOW.split(",").map(Number)) shots.push({ show: t });
} else {
  for (const p of (process.env.POSES ?? "eye:0:0:0").split(",")) {
    const [picture, tilt, spin, lift] = p.split(":");
    shots.push({ picture, tilt: +tilt, spin: +spin, lift: +lift });
  }
}
for (const [k, s] of shots.entries()) {
  if (s.show !== undefined) {
    await page.evaluate(
      async ([t, frames]) => {
        const g = window.__glass;
        // run the show up to t at 60 steps a second, then let the light converge where it is
        g.clock.hold = 0;
        for (let f = 0; f <= Math.round(t * 60); f++) {
          g.clock.hold = f / 60;
          await new Promise((r) => requestAnimationFrame(r));
        }
      },
      [s.show, frames],
    );
  } else {
    await page.evaluate(
      async ([s, frames]) => {
        const g = window.__glass;
        g.place(s.picture, s.tilt, s.spin, s.lift);
        await g.settle(frames);
      },
      [s, frames],
    );
  }
  if (process.env.DRAG) {
    // a real drag with the mouse: down at the middle, DRAG=dx:dy pixels over 30 moves, then let the light settle
    const [dx, dy] = process.env.DRAG.split(":").map(Number);
    await page.mouse.move(w / 2, h / 2);
    await page.mouse.down();
    for (let m = 1; m <= 30; m++) await page.mouse.move(w / 2 + (dx * m) / 30, h / 2 + (dy * m) / 30);
    await page.mouse.up();
    await page.evaluate(() => window.__glass.settle(60));
  }
  const name = shots.length > 1 ? out.replace(/\.png$/, `-${k}.png`) : out;
  fs.writeFileSync(name, await page.screenshot({ timeout: 60000 }));
}
if (process.env.BENCH) console.log("gpu ms/frame", (await page.evaluate(() => window.__glass.bench(30))).toFixed(2));
console.log(JSON.stringify(await page.evaluate(() => window.__glass.designs)));
console.log(bad.length ? `${bad.length} problems:\n${[...new Set(bad)].join("\n")}` : "clean");
await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 2500))]);
process.exit(0);
