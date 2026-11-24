// node tools/catastrophe-shot.mjs <out.png> [WxH] [seconds to wait]: renders catastrophe.html headless with real WebGPU, no flags.
// AT=p1,p2 holds the loop at those playheads (0..1) and writes out-<p>.png for each. SET='{"view":{...},"motion":{...}}'.
// MOUSE=x,y puts the (eased) cursor at x,y in [-1,1]. DPR=2 for retina. BENCH=1 prints GPU ms per frame. CHECK=1 compares the
// Pearcey field against a double-precision reference.
import { chromium } from "playwright-core";
import fs from "node:fs";
import os from "node:os";
const [out = "cat.png", size = "1280x720", wait = "0.5"] = process.argv.slice(2);
const url = process.env.URL ?? "http://localhost:5310/catastrophe.html";
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
await page.waitForFunction(() => window.__catastrophe?.frame > 2, null, { timeout: 60000 }).catch(() => bad.push("never drew"));
if (process.env.SET)
  await page.evaluate((s) => {
    const c = window.__catastrophe;
    const v = JSON.parse(s);
    for (const k of Object.keys(v)) Object.assign(c[k], v[k]);
  }, process.env.SET);
if (process.env.MOUSE) await page.evaluate((m) => window.__catastrophe.setMouse(...m.split(",").map(Number)), process.env.MOUSE);
await page.addStyleTag({ content: ".lil-gui,canvas+div,body>div:not(:has(canvas)){display:none!important}" });
if (process.env.SETS) {
  // one shot per settings object, out-0.png, out-1.png...
  const list = JSON.parse(process.env.SETS);
  for (let i = 0; i < list.length; i++) {
    await page.evaluate((v) => {
      const c = window.__catastrophe;
      for (const k of Object.keys(v)) if (k !== "hold") Object.assign(c[k], v[k]);
      if (v.hold !== undefined) c.clock.hold = v.hold;
    }, list[i]);
    await new Promise((r) => setTimeout(r, +wait * 1000));
    fs.writeFileSync(out.replace(/\.png$/, `-${i}.png`), await page.screenshot({ timeout: 60000 }));
  }
}
const times = process.env.AT ? process.env.AT.split(",").map(Number) : process.env.SETS ? [] : [null];
for (const t of times) {
  if (t !== null) await page.evaluate((t) => (window.__catastrophe.clock.hold = t), t);
  await new Promise((r) => setTimeout(r, +wait * 1000));
  const name = t === null ? out : out.replace(/\.png$/, `-${t}.png`);
  fs.writeFileSync(name, await page.screenshot({ timeout: 60000 }));
}
if (process.env.CHECK) {
  // Pearcey at the texels' own control points, against a long rotated-contour sum in double precision
  const res = await page.evaluate(async () => {
    const c = window.__catastrophe;
    c.view.mode = "pearcey";
    c.motion.turn = 0;
    c.clock.hold = 0;
    c.setMouse(0, 0);
    await new Promise((r) => setTimeout(r, 400));
    const f = await c.readField();
    return { f, s: c.slice(), ax: innerWidth / innerHeight, zoom: c.view.zoom, fringes: c.view.fringes };
  });
  const { f, s, ax, zoom, fringes } = res;
  const ref = (a1, a2) => {
    // exp(i(t^4 + a2 t^2 + a1 t)) along t = r e^{i pi/8}, r over the real line
    const e = [Math.cos(Math.PI / 8), Math.sin(Math.PI / 8)];
    let re = 0,
      im = 0;
    const N = 60000,
      S = 7;
    for (let j = 0; j < N; j++) {
      const r = -S + ((j + 0.5) / N) * 2 * S;
      const z = [r * e[0], r * e[1]];
      const z2 = [z[0] * z[0] - z[1] * z[1], 2 * z[0] * z[1]];
      const z4 = [z2[0] * z2[0] - z2[1] * z2[1], 2 * z2[0] * z2[1]];
      const p = [z4[0] + a2 * z2[0] + a1 * z[0], z4[1] + a2 * z2[1] + a1 * z[1]];
      const m = Math.exp(-p[1]);
      const v = [m * Math.cos(p[0]), m * Math.sin(p[0])];
      re += ((v[0] * e[0] - v[1] * e[1]) * (2 * S)) / N;
      im += ((v[0] * e[1] + v[1] * e[0]) * (2 * S)) / N;
    }
    return [re, im];
  };
  let worst = 0,
    worstRel = 0,
    sym = 0;
  const lines = [];
  for (let k = 0; k < 40; k++) {
    const ix = Math.floor((((k * 37) % 97) / 97) * f.W);
    const iy = Math.floor((((k * 53) % 89) / 89) * f.H);
    const uvx = (ix + 0.5) / f.W,
      uvy = (iy + 0.5) / f.H;
    const sc = s.scale / zoom;
    const p = [(uvx * 2 - 1) * ax * sc, (1 - uvy * 2) * sc];
    // shape units to the integral's: a_k times lam^(n-k), n = 4
    const L = s.lam * fringes;
    const a1 = (s.c[0] + p[0] * s.u[0] + p[1] * s.v[0]) * L ** 3;
    const a2 = (s.c[1] + p[0] * s.u[1] + p[1] * s.v[1]) * L ** 2;
    // where growth along the pi/8 line stays tame the reference is trustworthy
    if (a2 < -9 || Math.abs(a1) > 30) continue;
    const r = ref(a1, a2);
    const g = [f.data[2 * (iy * f.W + ix)], f.data[2 * (iy * f.W + ix) + 1]];
    const err = Math.hypot(g[0] - r[0], g[1] - r[1]);
    worst = Math.max(worst, err);
    worstRel = Math.max(worstRel, err / Math.max(0.05, Math.hypot(...r)));
    // |P(x, y)| = |P(-x, y)|
    const mx = f.W - 1 - ix;
    const gm = [f.data[2 * (iy * f.W + mx)], f.data[2 * (iy * f.W + mx) + 1]];
    sym = Math.max(sym, Math.abs(Math.hypot(...g) - Math.hypot(...gm)));
    if (k < 6) lines.push(`(${a1.toFixed(2)}, ${a2.toFixed(2)}) gpu ${Math.hypot(...g).toFixed(4)} ref ${Math.hypot(...r).toFixed(4)}`);
  }
  console.log(lines.join("\n"));
  console.log(`check: worst |err| ${worst.toExponential(2)}, worst rel ${worstRel.toExponential(2)}, |P| mirror asymmetry ${sym.toExponential(2)} (mirror texel is not exactly -x unless W is even: ${f.W})`);
}
if (process.env.BENCH) console.log("gpu ms/frame", (await page.evaluate(() => window.__catastrophe.bench(20))).toFixed(2));
console.log(bad.length ? `${bad.length} problems:\n${[...new Set(bad)].join("\n")}` : "clean");
await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 2500))]);
process.exit(0);
