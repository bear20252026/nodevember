// node tools/strip.mjs <out.png> <feather k> <from tau> <to tau> <count> [crop px]: close-ups of feather k's bird, tau seconds after
// the feather is let go, side by side: the way to look at the moment a feather turns out to be a bird. SET as in shot.mjs; COLS.
import { chromium } from "playwright-core";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
const [out = "strip.png", k = "0", from = "4", to = "7", count = "12", crop = "150"] = process.argv.slice(2);
const base = os.homedir() + "/Library/Caches/ms-playwright/chromium-1243/";
const sub = fs.readdirSync(base).find((d) => d.startsWith("chrome-"));
const app = fs.readdirSync(base + sub).find((d) => d.endsWith(".app"));
const browser = await chromium.launch({ executablePath: `${base}${sub}/${app}/Contents/MacOS/${app.replace(".app", "")}`, headless: true });
const W = 1024;
const page = await browser.newPage({ viewport: { width: W, height: W }, deviceScaleFactor: 2 });
const bad = [];
page.on("pageerror", (e) => bad.push(e.message.slice(0, 600)));
await page.goto(process.env.URL ?? "http://localhost:5312/");
await page.waitForFunction(() => window.__feather && window.__feather.state.frame > 2, null, { timeout: 60000 });
await page.addStyleTag({ content: ".lil-gui,canvas+div,body>div:not(:has(canvas)){display:none!important}" });
await page.evaluate((s) => {
  const r = window.__feather;
  if (s) Object.assign(r.look, JSON.parse(s));
  r.refresh();
}, process.env.SET);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "strip-"));
const files = [];
const born = 0.4 + 2 * +k;
for (let i = 0; i < +count; i++) {
  const tau = +from + ((+to - +from) * i) / Math.max(1, +count - 1);
  const at = await page.evaluate(
    ([ph, k]) =>
      new Promise((done) => {
        const r = window.__feather;
        r.state.hold = ph;
        let n = 0;
        const f = () => {
          if (++n < 6) return requestAnimationFrame(f);
          const b = r.flock.find((f) => f.l === k && f.copy === 0);
          const v = b.place.position.clone().project(r.camera);
          done([v.x * 0.5 + 0.5, 0.5 - v.y * 0.5]);
        };
        requestAnimationFrame(f);
      }),
    [((((born + tau) % 12) + 12) % 12) / 12, +k],
  );
  const c = +crop;
  const x = Math.round(Math.min(W - c, Math.max(0, at[0] * W - c / 2)));
  const y = Math.round(Math.min(W - c, Math.max(0, at[1] * W - c / 2)));
  const file = path.join(tmp, `s${String(i).padStart(2, "0")}.png`);
  fs.writeFileSync(file, await page.screenshot({ clip: { x, y, width: c, height: c }, timeout: 60000 }));
  execFileSync("magick", [file, "-gravity", "NorthWest", "-fill", "white", "-pointsize", "22", "-annotate", "+6+4", tau.toFixed(2), file]);
  files.push(file);
}
execFileSync("montage", [...files, "-tile", `${process.env.COLS ?? count}x`, "-geometry", "+2+2", "-background", "#222", out]);
console.log(bad.length ? bad.join("\n") : "clean");
await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 2500))]);
process.exit(0);
