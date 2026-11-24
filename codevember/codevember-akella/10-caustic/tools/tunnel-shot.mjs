// node tools/tunnel-shot.mjs <out.png> [WxH]: renders the tunnel (index.html) headless with real WebGPU.
// AT=1,2.5 writes a shot at each second of growth (out-<k>.png when more than one). SET='{"look":{...}}' changes settings,
// BENCH=1 prints GPU ms/frame, DPR=2 for retina, DRAG='0.3:0.5:0.7:0.6@1' turns the camera with a real drag.
import { chromium } from "playwright-core";
import fs from "node:fs";
import os from "node:os";
const [out = "tunnel.png", size = "1280x720"] = process.argv.slice(2);
const url = process.env.URL ?? "http://localhost:5310/";
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
});
await page.goto(url);
await page.waitForFunction(() => window.__tunnel && window.__tunnel.frame > 2, null, { timeout: 30000 }).catch(() => bad.push("never drew"));
if (process.env.SET)
  await page.evaluate((s) => {
    const g = window.__tunnel;
    const v = JSON.parse(s);
    for (const k of Object.keys(v)) Object.assign(g[k], v[k]);
    g.reseed();
  }, process.env.SET);
if (process.env.FORM)
  await page.evaluate((f) => {
    window.__tunnel.lattice.form = f;
    window.__tunnel.usePreset(f);
  }, process.env.FORM);
await page.evaluate(() => window.__tunnel.advance(0.1));
await page.waitForFunction(() => window.__tunnel.ready, null, { timeout: 60000 }).catch(() => bad.push("mesh never ready"));
await page.addStyleTag({ content: ".lil-gui,body>div{display:none!important}" });
const throws = ""
  .split(",")
  .filter(Boolean)
  .map((s) => {
    const [what, at = "0"] = s.split("@");
    const [kind, x, z] = what.split(":");
    return { kind, x: +x, z: +z, at: +at };
  });
const ats = (process.env.AT ?? "2").split(",").map(Number);
let now = 0;
// DRAG='0.3:0.5:0.7:0.6@1' drags from (0.3, 0.5) to (0.7, 0.6) of the screen at that second
const drags = (process.env.DRAG ?? "")
  .split(",")
  .filter(Boolean)
  .map((s) => {
    const [d, at = "0"] = s.split("@");
    return { t: +at, drag: d.split(":").map(Number) };
  });
const events = [...throws.map((t) => ({ t: t.at, throw: t })), ...drags, ...ats.map((t, k) => ({ t, shot: k }))].sort((a, b) => a.t - b.t);
for (const e of events) {
  if (e.t > now) {
    await page.evaluate((s) => window.__tunnel.advance(s), e.t - now);
    now = e.t;
  }
  if (e.throw) await page.evaluate((t) => 0, e.throw);
  if (e.drag) {
    // a real mouse drag across the water, a step of the world per move
    const [x0, y0, x1, y1] = e.drag;
    await page.mouse.move(x0 * w, y0 * h);
    await page.mouse.down();
    for (let m = 1; m <= 24; m++) {
      await page.mouse.move((x0 + ((x1 - x0) * m) / 24) * w, (y0 + ((y1 - y0) * m) / 24) * h);
      await page.evaluate(() => window.__tunnel.advance(1 / 60));
    }
    await page.mouse.up();
    now += 24 / 60;
  }
  if (e.shot !== undefined) {
    const name = ats.length > 1 ? out.replace(/\.png$/, `-${e.shot}.png`) : out;
    fs.writeFileSync(name, await page.screenshot({ timeout: 60000 }));
  }
}
if (process.env.BENCH) console.log("gpu ms/frame", (await page.evaluate(() => window.__tunnel.bench(30))).toFixed(2));
console.log(bad.length ? `${bad.length} problems:\n${[...new Set(bad)].join("\n")}` : "clean");
await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 2500))]);
