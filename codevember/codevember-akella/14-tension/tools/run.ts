// node --experimental-strip-types tools/run.ts [periods=12] [sheet.png]: run the chain headless, say what each
// period did and how far it is from the one before (in rope lengths, over what the picture shows), and
// optionally draw a sheet of frames from the last period. SET='{"damp":20}' changes values.
import fs from "node:fs";
import os from "node:os";
const px = Number(process.env.PX ?? 300);
import { P, Chain } from "../src/sim.ts";
if (process.env.SET) Object.assign(P, JSON.parse(process.env.SET));
const periods = Number(process.argv[2] ?? 12);
const sheet = process.argv[3];
const c = new Chain();
const TF = c.TF;
const who: string[] = [];
const snap = () => {
  const z = c.zoom((c.frame % TF) / TF || 0);
  const zz = c.frame % TF === 0 ? 0.5 : z;
  const [ox, oy] = [0, 0];
  const o: number[] = [(c.sx - ox) * zz, (c.sy - oy) * zz];
  who.length = 0;
  who.push("stone", "stone");
  for (let i = 0; i < c.n; i++)
    if (Math.min(c.gen[i], i ? c.gen[i - 1] : 99) <= 2) {
      o.push((c.x[i] - ox) * zz, (c.y[i] - oy) * zz);
      const tag = `node ${i - c.child()[0]} gen ${c.gen[i]}`;
      who.push(tag + " x", tag + " y");
    }
  return o;
};
const marks = [
  1,
  Math.round(TF * 0.25),
  Math.round(TF * 0.5),
  Math.round(TF * 0.75),
  TF - 2,
];
let was: number[][] = [];
const frames: string[] = [];
const draw = (label: string) => {
  const z = c.zoom((c.frame % TF) / TF);
  const [ox, oy] = [0, 0];
  const X = (v: number) => ((v - ox) * z).toFixed(4),
    Y = (v: number) => (-(v - oy) * z).toFixed(4);
  let d = "";
  let s = "";
  for (let i = 0; i < c.n - 1; i++) {
    const k = c.gen[i];
    if (k > 3) continue;
    const wd = P.rope * 2 * 2 ** k * z;
    const col = ["#e8c27a", "#b98a4a", "#8a6234", "#5c4022"][k];
    s += `<line x1="${X(c.x[i])}" y1="${Y(c.y[i])}" x2="${X(c.x[i + 1])}" y2="${Y(c.y[i + 1])}" stroke="${col}" stroke-width="${wd.toFixed(4)}" stroke-linecap="round"/>`;
  }
  d += s;
  d += `<circle cx="${X(c.sx)}" cy="${Y(c.sy)}" r="${P.stoneR}" fill="#9aa" fill-opacity="0.85"/>`;
  d += `<text x="-0.95" y="-0.85" font-size="0.09" fill="#fff">${label}</text>`;
  frames.push(d);
};
for (let n = 0; n < periods; n++) {
  const now: number[][] = [];
  for (let f = 0; f < TF; f++) {
    c.step();
    const ff = c.frame % TF;
    if (marks.includes(ff)) now.push(snap());
    if (
      sheet &&
      n >= periods - Number(process.env.LAST ?? 1) &&
      f % Math.round(TF / Number(process.env.PER ?? 24)) === 0
    )
      draw(`${(f / TF).toFixed(2)}`);
  }
  let worst = 0,
    where = "";
  if (was.length)
    for (let m = 0; m < now.length; m++) {
      const a = now[m],
        b = was[m];
      if (a.length !== b.length) {
        worst = 99;
        continue;
      }
      for (let i = 0; i < a.length; i++)
        if (Math.abs(a[i] - b[i]) > worst)
          ((worst = Math.abs(a[i] - b[i])),
            (where = `at ${marks[m] / TF} ${who[i]}`));
    }
  was = now;
  console.log(
    `${String(n).padStart(2)} peak pull ${c.log.peak.toFixed(1)} frames touching ${c.log.touched} lands ${(c.log.lands / TF).toFixed(3)} rope at 0.9: ${c.log.bottom.toFixed(3)} nodes ${c.n} off ${worst.toExponential(2)} ${where}`,
  );
}
if (sheet) {
  // browsers draw svg properly; imagemagick's own renderer does not
  const cols = Number(process.env.COLS ?? 6);
  const rows = Math.ceil(frames.length / cols);
  const html = `<body style="margin:0;background:#333"><svg xmlns="http://www.w3.org/2000/svg" width="${cols * (px + 3)}" height="${rows * (px + 3)}">${frames
    .map(
      (d, i) =>
        `<svg x="${(i % cols) * (px + 3)}" y="${Math.floor(i / cols) * (px + 3)}" width="${px}" height="${px}" viewBox="-1 -1.5 2 2"><rect x="-1" y="-1.5" width="2" height="2" fill="#111"/>${d}</svg>`,
    )
    .join("")}</svg></body>`;
  const file = os.tmpdir() + "/tension-sheet.html";
  fs.writeFileSync(file, html);
  const { chromium } = await import("playwright-core");
  const base = os.homedir() + "/Library/Caches/ms-playwright/chromium-1243/";
  const sub = fs.readdirSync(base).find((d) => d.startsWith("chrome-"))!;
  const app = fs.readdirSync(base + sub).find((d) => d.endsWith(".app"))!;
  const browser = await chromium.launch({
    executablePath: `${base}${sub}/${app}/Contents/MacOS/${app.replace(".app", "")}`,
    headless: true,
  });
  const page = await browser.newPage({
    viewport: {
      width: cols * (px + 3),
      height: Math.ceil(frames.length / cols) * (px + 3),
    },
  });
  await page.goto("file://" + file);
  fs.writeFileSync(sheet, await page.screenshot({ fullPage: true }));
  await Promise.race([
    browser.close(),
    new Promise((r) => setTimeout(r, 2500)),
  ]);
  process.exit(0);
}
