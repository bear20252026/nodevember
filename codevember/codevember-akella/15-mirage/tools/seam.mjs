// node tools/seam.mjs: is going through each door seamless? For every door, the page just before it and just
// after (2e-5 of the loop either side), against an ordinary step of the same size just before, and the same
// again a hundred times nearer the door. The numbers of a pair should be alike. Grain is off for it: its
// pattern changes sixty times a second, and a door that falls on such a change looks like a jump when it is
// not. URL (the dev server is expected on 5315), SET.
import { chromium } from "playwright-core";
import fs from "node:fs";
import os from "node:os";
import { spawnSync } from "node:child_process";
import path from "node:path";
const base = os.homedir() + "/Library/Caches/ms-playwright/chromium-1243/";
const sub = fs.readdirSync(base).find((d) => d.startsWith("chrome-"));
const app = fs.readdirSync(base + sub).find((d) => d.endsWith(".app"));
const browser = await chromium.launch({
  executablePath: `${base}${sub}/${app}/Contents/MacOS/${app.replace(".app", "")}`,
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(process.env.URL ?? "http://localhost:5315/");
await page.waitForFunction(
  () =>
    window.__mirage &&
    window.__mirage.state.skies > 0 &&
    window.__mirage.state.busy === 0,
  null,
  { timeout: 90000 },
);
await page.addStyleTag({
  content: ".lil-gui,body>div{display:none!important}",
});
await page.evaluate((set) => {
  const m = window.__mirage;
  const before = { ...m.look };
  Object.assign(m.look, { grain: 0 }, JSON.parse(set ?? "{}"));
  for (const k of Object.keys(m.look))
    if (m.look[k] !== before[k]) m.changed(k);
}, process.env.SET);
await page.waitForTimeout(800);
await page.waitForFunction(() => window.__mirage.state.busy === 0, null, {
  timeout: 90000,
});
const ends = await page.evaluate(() => window.__mirage.state.ends);
const shot = async (v) => {
  await page.evaluate(
    (v) => (window.__mirage.state.hold = v),
    ((v % 1) + 1) % 1,
  );
  const f0 = await page.evaluate(() => window.__mirage.state.frame);
  await page.waitForFunction((f) => window.__mirage.state.frame > f + 3, f0, {
    timeout: 60000,
  });
  const file = path.join(
    os.tmpdir(),
    `mirage-seam-${process.pid}-${Math.random().toString(36).slice(2)}.png`,
  );
  fs.writeFileSync(file, await page.screenshot());
  return file;
};
const apart = (a, b) => {
  // (compare writes how far apart they are on stderr, and exits 1 when they differ at all)
  const out = spawnSync("magick", [
    "compare",
    "-metric",
    "MAE",
    a,
    b,
    "null:",
  ]).stderr.toString();
  return (+(/\(([^)]+)\)/.exec(out)?.[1] ?? NaN)).toExponential(2);
};
for (const [k, e] of ends.entries()) {
  const row = [];
  for (const d of [2e-5, 2e-7]) {
    const files = [await shot(e - 3 * d), await shot(e - d), await shot(e + d)];
    row.push(
      `${d}: across ${apart(files[1], files[2])}, a step before ${apart(files[0], files[1])}`,
    );
    files.forEach((f) => fs.unlinkSync(f));
  }
  console.log(`door ${k + 1} at ${e.toFixed(6)}   ${row.join("   ")}`);
}
await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 2500))]);
process.exit(0);
