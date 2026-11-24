// node --experimental-strip-types tools/trace.ts out.svg [keys]: how the baked caps move, for a look without the
// picture. Above: each cap's height in the picture against its age. Below: its sideways place, less its mean.
import fs from "node:fs";
const buf = fs.readFileSync("public/spore.bin");
const hl = buf.readUInt32LE(0);
const head = JSON.parse(buf.subarray(4, 4 + hl).toString());
const data = new Int16Array(buf.buffer.slice(buf.byteOffset + 4 + hl, buf.byteOffset + buf.length));
const [out = "trace.svg", count = "14"] = process.argv.slice(2);
const v = head.H / head.T;
const W = 1500,
  H1 = 520,
  H2 = 300,
  T = 26;
const cols = ["#f96", "#6cf", "#9f6", "#fc6", "#c9f", "#6fc", "#f69", "#ccc"];
let svg = "";
let start = 0;
const starts: number[] = [];
for (const k of head.keys) {
  starts.push(start);
  start += k.frames;
}
const step = Math.floor(head.keys.length / +count);
for (let n = 0; n < +count; n++) {
  const ki = n * step;
  const k = head.keys[ki];
  const tip = (f: number, d: number) => data[((starts[ki] + f) * head.pts + head.pts - 1) * 3 + d] * head.Q;
  let high = "",
    side = "";
  let mean = 0;
  for (let f = 0; f < k.frames; f++) mean += tip(f, 0) / k.frames;
  for (let f = 0; f < k.frames; f++) {
    const age = k.a0 + f / head.fps;
    if (age > T) break;
    const y = -head.DEPTH + k.y + tip(f, 1) - v * age;
    high += `${((age / T) * W).toFixed(1)},${(H1 * (0.5 - y / 4.2)).toFixed(1)} `;
    side += `${((age / T) * W).toFixed(1)},${(H1 + H2 / 2 - (tip(f, 0) - mean) * 220).toFixed(1)} `;
  }
  svg += `<polyline points="${high}" fill="none" stroke="${cols[n % cols.length]}" stroke-width="1.6"/><polyline points="${side}" fill="none" stroke="${cols[n % cols.length]}" stroke-width="1.2"/>`;
}
let grid = "";
for (let t = 0; t <= T; t += 2) grid += `<line x1="${(t / T) * W}" x2="${(t / T) * W}" y1="0" y2="${H1 + H2}" stroke="#333"/><text x="${(t / T) * W + 3}" y="14" fill="#888" font-size="12">${t}s</text>`;
for (const y of [-1.75, 0, 1.75]) grid += `<line x1="0" x2="${W}" y1="${H1 * (0.5 - y / 4.2)}" y2="${H1 * (0.5 - y / 4.2)}" stroke="#555"/>`;
fs.writeFileSync(out, `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H1 + H2}"><rect width="100%" height="100%" fill="#111"/>${grid}${svg}</svg>`);
