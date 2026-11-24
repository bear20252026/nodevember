// node tools/stairs-follow.mjs <out prefix> : clicks a walker whose floor is a wall, checks that the view goes with it and turns it upright, then lets go (Escape) and turns (T). Writes three screenshots.
import { chromium } from "playwright-core";
import fs from "node:fs";
import os from "node:os";
const out = process.argv[2];
const base = os.homedir() + "/Library/Caches/ms-playwright/chromium-1243/";
const sub = fs.readdirSync(base).find((d) => d.startsWith("chrome-"));
const app = fs.readdirSync(base + sub).find((d) => d.endsWith(".app"));
const browser = await chromium.launch({ executablePath: `${base}${sub}/${app}/Contents/MacOS/${app.replace(".app", "")}`, headless: true });
const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
const bad = [];
page.on("pageerror", (e) => bad.push(e.message));
await page.goto("http://localhost:5313/");
await page.waitForFunction(() => window.__stairs && window.__stairs.state.frame > 30, null, { timeout: 60000 });
await page.addStyleTag({ content: ".lil-gui,canvas+div{display:none!important}" });
// a walker whose up is x: where it is on the screen
const target = await page.evaluate(() => {
  const r = window.__stairs;
  r.look.drift = 0;
  const people = r.people();
  const b = r.bodies();
  const v = r.view();
  const FIG = 35;
  const ext = [8 * Math.SQRT2, 8 * Math.sqrt(6)];
  const k = v.client / v.width;
  for (let id = 0; id < people.length; id++) {
    const f = people[id];
    if (f.kind !== "walker" || f.route.up === 1) continue;
    let [dx, dy] = [1e9, 1e9];
    for (const n of [id * 2, id * 2 + 1]) {
      let ex = b[n * FIG * 4 + 4] - v.middle[0], ey = b[n * FIG * 4 + 5] - v.middle[1];
      ex -= Math.round(ex / ext[0]) * ext[0];
      ey -= Math.round(ey / ext[1]) * ext[1];
      if (Math.hypot(ex, ey) < Math.hypot(dx, dy)) [dx, dy] = [ex, ey];
    }
    const [x, y] = [(v.width / 2 + dx * v.scale) * k, (v.height / 2 - dy * v.scale) * k];
    if (x > 40 && x < 1160 && y > 40 && y < 760) return { id, up: f.route.up, x, y };
  }
  return null;
});
console.log("clicking walker", target.id, "up", "xyz"[target.up], "at", target.x.toFixed(0), target.y.toFixed(0));
await page.mouse.click(target.x, target.y);
await page.waitForTimeout(2500);
const after = await page.evaluate(() => ({ follow: window.__stairs.eye.follow, angle: (window.__stairs.eye.angle * 180 / Math.PI).toFixed(1), zoom: window.__stairs.look.zoom.toFixed(2) }));
console.log("after 2.5 s:", JSON.stringify(after));
await page.screenshot({ path: out + "-follow.png" });
await page.waitForTimeout(3000);
await page.screenshot({ path: out + "-follow2.png" });
await page.keyboard.press("Escape");
await page.keyboard.press("KeyT");
await page.waitForTimeout(2500);
console.log("after Escape and T:", JSON.stringify(await page.evaluate(() => ({ follow: window.__stairs.eye.follow, angle: (window.__stairs.eye.angle * 180 / Math.PI).toFixed(1) }))));
await page.screenshot({ path: out + "-turned.png" });
console.log(bad.length ? bad.join("\n") : "no errors");
await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 2500))]);
process.exit(0);
