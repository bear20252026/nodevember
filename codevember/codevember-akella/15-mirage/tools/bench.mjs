// node tools/bench.mjs [WxH]: how long the GPU takes over a frame (milliseconds), at moments of the loop, for
// ways of setting it up given in RUNS (a JSON list of look values, each a run; default: the light baked and
// not). Frames are given to the GPU sixty at a time so that it runs at its full clock; see `bench` in index.ts.
// MOMENTS, DPR (2 is the laptop's screen), URL.
import { chromium } from "playwright-core";
import fs from "node:fs";
import os from "node:os";
const [size = "1728x1080"] = process.argv.slice(2);
const url = process.env.URL ?? "http://localhost:5315/";
const moments = JSON.parse(
  process.env.MOMENTS ?? "[0.05, 0.25, 0.45, 0.65, 0.85]",
);
const runs = JSON.parse(
  process.env.RUNS ?? '[{"baked": false}, {"baked": true}]',
);
const base = os.homedir() + "/Library/Caches/ms-playwright/chromium-1243/";
const sub = fs.readdirSync(base).find((d) => d.startsWith("chrome-"));
const app = fs.readdirSync(base + sub).find((d) => d.endsWith(".app"));
const browser = await chromium.launch({
  executablePath: `${base}${sub}/${app}/Contents/MacOS/${app.replace(".app", "")}`,
  headless: true,
});
const [w, h] = size.split("x").map(Number);
const page = await browser.newPage({
  viewport: { width: w, height: h },
  deviceScaleFactor: +(process.env.DPR ?? 2),
});
page.on("pageerror", (e) => console.log(e.message.slice(0, 500)));
await page.goto(url);
await page.waitForFunction(
  () =>
    window.__mirage &&
    window.__mirage.state.skies > 0 &&
    window.__mirage.state.busy === 0,
  null,
  { timeout: 120000 },
);
console.log(`${url}  ${w}x${h} at ${process.env.DPR ?? 2}x`);
for (const run of runs) {
  const { whole = true, ...set } = run;
  // (each run from the page's own look, not the run before's)
  await page.evaluate((set) => {
    const m = window.__mirage;
    m.first ??= { ...m.look };
    const before = { ...m.look };
    Object.assign(m.look, m.first, set);
    for (const k of Object.keys(m.look))
      if (m.look[k] !== before[k]) m.changed(k);
  }, set);
  await page.waitForTimeout(500);
  await page.waitForFunction(() => window.__mirage.state.busy === 0, null, {
    timeout: 120000,
  });
  const got = await page.evaluate(
    async ({ moments, whole }) => {
      const out = [];
      for (const ph of moments) {
        // the least of three goes: anything else running can only make one slower
        const tries = [];
        for (let k = 0; k < 3; k++)
          tries.push(await window.__mirage.bench(60, ph, whole));
        out.push(Math.min(...tries));
      }
      return out;
    },
    { moments, whole },
  );
  const mean = got.reduce((a, b) => a + b, 0) / got.length;
  console.log(
    `${JSON.stringify(run).padEnd(40)} ${got.map((v, i) => `${moments[i]}: ${v.toFixed(2)}`).join("  ")}   mean ${mean.toFixed(2)} ms`,
  );
}
await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 2500))]);
process.exit(0);
