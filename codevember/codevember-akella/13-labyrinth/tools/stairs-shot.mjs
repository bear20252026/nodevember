// node tools/stairs-shot.mjs <out.png> [WxH] [samples] : the stairs page, headless, after that many samples of light.
// SET='{"seed":3,"fans":0.5}' changes look values (the pile is remade); CENTRE=x,y looks there (units across and up); DPR;
// URL=http://localhost:5313/planet.html for the planet, and TURN=0.5,0.4 turns it (round the sun, and over);
// HOLD=0.3 is the moment of the loop (the picture does not drift here, so only the people differ).
import { chromium } from "playwright-core";
import fs from "node:fs";
import os from "node:os";
const [out = "stairs.png", size = "1200x1200", samples = "64"] = process.argv.slice(2);
const url = process.env.URL ?? "http://localhost:5313/";
const base = os.homedir() + "/Library/Caches/ms-playwright/chromium-1243/";
const sub = fs.readdirSync(base).find((d) => d.startsWith("chrome-"));
const app = fs.readdirSync(base + sub).find((d) => d.endsWith(".app"));
const browser = await chromium.launch({ executablePath: `${base}${sub}/${app}/Contents/MacOS/${app.replace(".app", "")}`, headless: true });
const [w, h] = size.split("x").map(Number);
const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: +(process.env.DPR ?? 1) });
const bad = [];
page.on("pageerror", (e) => bad.push(e.message.slice(0, 1500)));
page.on("console", (m) => {
  if (["error", "warning"].includes(m.type()) && !m.text().includes("404")) bad.push(m.text().replace(/[ \t]+/g, " ").slice(0, 1500));
});
await page.goto(url);
await page.waitForFunction(() => window.__stairs && window.__stairs.state.frame > 2, null, { timeout: 60000 }).catch(() => bad.push("never started"));
await page.addStyleTag({ content: ".lil-gui,canvas+div,body>div:not(:has(canvas)){display:none!important}" });
const t0 = Date.now();
const info = await page.evaluate(([s, c, h, t]) => {
  const r = window.__stairs;
  if (!r) return null;
  Object.assign(r.look, { drift: 0, smooth: false, ...JSON.parse(s ?? "{}") }); // (whole samples: nobody is watching the frames)
  r.state.hold = h;
  if (c) (r.centre[0] = c[0]), (r.centre[1] = c[1]);
  if (t) (r.turned[0] = t[0]), (r.turned[1] = t[1]);
  r.rebuild();
  return r.world().count;
}, [process.env.SET, process.env.CENTRE ? process.env.CENTRE.split(",").map(Number) : null, +(process.env.HOLD ?? 0), process.env.TURN ? process.env.TURN.split(",").map(Number) : null]);
await page.waitForFunction((n) => window.__stairs.state.samples >= n, +samples, { timeout: 300000 }).catch(() => bad.push("too slow"));
const took = (Date.now() - t0) / 1000;
fs.writeFileSync(out, await page.screenshot({ timeout: 60000 }));
console.log(JSON.stringify(info), `${samples} samples in ${took.toFixed(1)} s (${(samples / took).toFixed(0)} a second)`, bad.length ? `${bad.length} problems:\n${[...new Set(bad)].join("\n")}` : "clean");
await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 2500))]);
process.exit(0);
