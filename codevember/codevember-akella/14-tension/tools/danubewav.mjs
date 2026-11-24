// node tools/danubewav.mjs <out.wav> [periods]: the Danube show's tune, rendered offline by the page's own
// synth (starting at the sim's time 0, like a take), to lay under a recorded take with ffmpeg
import { chromium } from "playwright-core";
import fs from "node:fs";
import os from "node:os";
const [out = "danube.wav", periods = "1"] = process.argv.slice(2);
const base = os.homedir() + "/Library/Caches/ms-playwright/chromium-1243/";
const sub = fs.readdirSync(base).find((d) => d.startsWith("chrome-"));
const app = fs.readdirSync(base + sub).find((d) => d.endsWith(".app"));
const browser = await chromium.launch({ executablePath: `${base}${sub}/${app}/Contents/MacOS/${app.replace(".app", "")}`, headless: true });
const page = await browser.newPage();
await page.goto(process.env.URL ?? "http://localhost:5314/?show=danube");
await page.waitForFunction(() => window.__cloth?.music, null, { timeout: 120000 });
const b64 = await page.evaluate(async (k) => {
  const blob = await window.__cloth.music.renderWav(k);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}, Number(periods));
fs.writeFileSync(out, Buffer.from(b64, "base64"));
console.log(`${out}: ${(fs.statSync(out).size / 1e6).toFixed(1)} MB`);
await browser.close();
