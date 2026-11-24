// node tools/stairs-film.mjs <out> [size] [frames] : the whole loop of the stairs page, square, centred on the way
// through, one 60 fps frame at a time, as <out>/f0000.png... and <out>.mp4 (h264, yuv420p, ready to post).
// The view is put across the way: the walkers on it are found over the loop, and the middle of the picture moved
// sideways (across the drift) to the middle of them, so the way runs down the middle as the pile goes by.
// SET='{"zoom":1}' changes look values (res, samples, zoom...); STILLS=1 only writes four stills; ALONG=n moves
// the view n units along the drift (to choose what is in the picture at the start); RESUME=1 keeps frames there.
import { chromium } from "playwright-core";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
const [out = "film", sizeArg = "1080", framesArg = "2880"] = process.argv.slice(2);
const size = +sizeArg;
const frames = +framesArg;
const base = os.homedir() + "/Library/Caches/ms-playwright/chromium-1243/";
const sub = fs.readdirSync(base).find((d) => d.startsWith("chrome-"));
const app = fs.readdirSync(base + sub).find((d) => d.endsWith(".app"));
const browser = await chromium.launch({ executablePath: `${base}${sub}/${app}/Contents/MacOS/${app.replace(".app", "")}`, headless: true });
const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
const bad = [];
page.on("pageerror", (e) => bad.push(e.message.slice(0, 400)));
await page.goto(process.env.URL ?? "http://localhost:5313/");
await page.waitForFunction(() => window.__stairs && window.__stairs.state.frame > 2, null, { timeout: 60000 });
await page.addStyleTag({ content: ".lil-gui,canvas+div,body>div:not(:has(canvas)){display:none!important}" });
await page.evaluate((s) => {
  const r = window.__stairs;
  Object.assign(r.look, { smooth: false, samples: 256, ...JSON.parse(s ?? "{}") });
  r.eye.follow = -1;
  r.rebuild();
}, process.env.SET);
const t0 = Date.now();
await page.waitForFunction(() => window.__stairs.state.samples >= window.__stairs.look.samples, null, { timeout: 1800000, polling: 1000 });
console.log(`light settled in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
const show = (hold) => page.evaluate((h) => new Promise((done) => ((window.__stairs.state.hold = h), requestAnimationFrame(() => requestAnimationFrame(done)))), hold);

// across the way: the walkers on it over the loop, the nearest likeness of each to the middle, how far across
// the drift they are from it; the middle moved by the mean of that (twice, as the nearest ones may change)
for (let pass = 0; pass < 2; pass++) {
  const offs = [];
  for (let n = 0; n < 48; n++) {
    await show(n / 48);
    offs.push(
      ...(await page.evaluate(() => {
        const r = window.__stairs;
        const people = r.people();
        const b = r.bodies();
        const v = r.view();
        const FIG = 3 + 18 * 2;
        const P = r.world().P;
        const ext = [P * Math.SQRT2, P * Math.sqrt(6)];
        const d = [1 / Math.SQRT2, -Math.sqrt(1.5)];
        const l = Math.hypot(d[0], d[1]);
        const [dx0, dy0] = [d[0] / l, d[1] / l];
        const res = [];
        people.forEach((f, id) => {
          if (f.kind !== "walker" || f.route.kind !== "on and on") return;
          let best = null;
          for (const n of [id * 2, id * 2 + 1])
            for (let a = -1; a <= 1; a++)
              for (let c = -1; c <= 1; c++) {
                let ex = b[n * FIG * 4] - v.middle[0], ey = b[n * FIG * 4 + 1] - v.middle[1];
                ex -= Math.round(ex / ext[0]) * ext[0] - a * ext[0];
                ey -= Math.round(ey / ext[1]) * ext[1] - c * ext[1];
                const across = -ex * dy0 + ey * dx0;
                if (!best || Math.abs(across) < Math.abs(best)) best = across;
              }
          res.push(best);
        });
        return res;
      })),
    );
  }
  const mean = offs.reduce((t, v) => t + v, 0) / offs.length;
  const spread = Math.sqrt(offs.reduce((t, v) => t + (v - mean) ** 2, 0) / offs.length);
  await page.evaluate(([m, along]) => {
    const r = window.__stairs;
    const d = [1 / Math.SQRT2, -Math.sqrt(1.5)];
    const l = Math.hypot(d[0], d[1]);
    r.centre[0] += (-d[1] / l) * m + (d[0] / l) * along;
    r.centre[1] += (d[0] / l) * m + (d[1] / l) * along;
  }, [mean, pass === 0 ? +(process.env.ALONG ?? 0) : 0]);
  console.log(`pass ${pass}: the way is ${mean.toFixed(3)} across from the middle (walkers wander ${spread.toFixed(3)} either side)`);
}
const centre = await page.evaluate(() => [...window.__stairs.centre]);
console.log(`centre ${centre.map((v) => v.toFixed(3)).join(",")}`);

fs.mkdirSync(out, { recursive: true });
if (process.env.STILLS) {
  for (const h of [0, 0.25, 0.5, 0.75]) {
    await show(h);
    fs.writeFileSync(`${out}/still-${h}.png`, await page.screenshot());
  }
} else {
  const t1 = Date.now();
  for (let n = 0; n < frames; n++) {
    const file = `${out}/f${String(n).padStart(4, "0")}.png`;
    if (process.env.RESUME && fs.existsSync(file)) continue;
    await show(n / frames);
    fs.writeFileSync(file, await page.screenshot());
    if (n % 240 === 0) console.log(`frame ${n}/${frames}, ${((Date.now() - t1) / 1000).toFixed(0)} s`);
  }
  // (the last frame is the one before the first: played round, the loop has no seam)
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", "60", "-i", `${out}/f%04d.png`, "-c:v", "libx264", "-preset", "slow", "-crf", "16", "-pix_fmt", "yuv420p", "-movflags", "+faststart", `${out}.mp4`]);
  console.log(`${frames} frames, ${out}.mp4`);
}
if (bad.length) console.log("page errors:", bad.slice(0, 5).join(" | "));
await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 2500))]);
process.exit(0);
