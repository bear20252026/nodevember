// node tools/camera.mjs: how smoothly the eye turns over the whole loop (a pose every 10 cm): the fastest it
// turns, how sharply that changes, and how often, in the 15 m before a door, it turns one way and then the
// other (a sway; there should be none). URL as in the other tools.
import { chromium } from "playwright-core";
import fs from "node:fs";
import os from "node:os";
const base = os.homedir() + "/Library/Caches/ms-playwright/chromium-1243/";
const sub = fs.readdirSync(base).find((d) => d.startsWith("chrome-"));
const app = fs.readdirSync(base + sub).find((d) => d.endsWith(".app"));
const browser = await chromium.launch({
  executablePath: `${base}${sub}/${app}/Contents/MacOS/${app.replace(".app", "")}`,
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 400, height: 300 } });
await page.goto(process.env.URL ?? "http://localhost:5315/");
await page.waitForFunction(
  () => window.__mirage && window.__mirage.state.skies > 0,
  null,
  { timeout: 120000 },
);
const rows = await page.evaluate(() => {
  const m = window.__mirage;
  const w = m.world();
  const out = [];
  const ends = m.state.ends;
  const deg = (r) => (r * 180) / Math.PI;
  // over the whole loop, a pose every 10 cm: how fast the view turns (deg/m), and how fast that changes
  const L = w.length;
  const step = 0.1;
  let sumJ = 0,
    nJ = 0,
    nearDoor = 0,
    sways = 0;
  let prev = null,
    prevTurn = null,
    worstTurn = 0,
    worstJerk = 0,
    atJerk = 0,
    worstLeanRate = 0,
    prevLean = null;
  for (let s0 = 0; s0 < L; s0 += step) {
    const p = m.pose(s0 / L);
    // the view's heading, in the frame of the lap it is on (headings jump at doors otherwise): from its own fore
    const look = Math.atan2(p.fore[0], p.fore[2]);
    const lean = deg(Math.asin(-p.right[1]));
    if (prev !== null && p.lap === prev.lap) {
      let d = look - prev.look;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      const turn = deg(d) / step;
      worstTurn = Math.max(worstTurn, Math.abs(turn));
      if (prevTurn !== null) {
        const jerk = Math.abs(turn - prevTurn) / step;
        if (jerk > worstJerk) {
          worstJerk = jerk;
          atJerk = s0;
        }
        sumJ += jerk * jerk;
        nJ++;
        // within 15 m before a door
        for (const e of m.state.ends) {
          const before = e * L - s0;
          if (before > 0 && before < 15) nearDoor = Math.max(nearDoor, jerk);
        }
        // and the sign changes of the turning there: a sway is a turn one way, then the other
        for (const e of m.state.ends) {
          const before = e * L - s0;
          if (
            before > 0.5 &&
            before < 15 &&
            Math.sign(turn) !== Math.sign(prevTurn) &&
            Math.abs(turn - prevTurn) > 0.02
          )
            sways++;
        }
      }
      prevTurn = turn;
      worstLeanRate = Math.max(worstLeanRate, Math.abs(lean - prevLean) / step);
    } else prevTurn = null;
    prev = { look, lap: p.lap };
    prevLean = lean;
  }
  out.push(
    `loop ${L.toFixed(1)} m: view turns at most ${worstTurn.toFixed(2)} deg/m; its turning changes at most ${worstJerk.toFixed(2)} deg/m per m (at ${atJerk.toFixed(1)} m, doors at ${m.state.ends.map((e) => (e * L).toFixed(1)).join(", ")}); lean changes at most ${worstLeanRate.toFixed(2)} deg/m; turning change: rms ${Math.sqrt(sumJ / nJ).toFixed(2)}, at most ${nearDoor.toFixed(2)} in the 15 m before doors; the turning changes sides ${sways} times in those`,
  );
  return out;
});
console.log(rows.join("\n"));
await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 2500))]);
process.exit(0);
