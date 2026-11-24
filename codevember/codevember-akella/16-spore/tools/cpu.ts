// node --experimental-strip-types tools/cpu.ts: what replaying the pile and sweeping the light cost a frame
import fs from "node:fs";
import { Stage } from "../src/stage.ts";
const buf = fs.readFileSync("public/spore.bin");
const hl = buf.readUInt32LE(0);
const head = JSON.parse(buf.subarray(4, 4 + hl).toString());
const data = new Int16Array(buf.buffer.slice(buf.byteOffset + 4 + hl, buf.byteOffset + buf.length));
const stage = new Stage(head, data);
if (process.argv[2]) stage.share = +process.argv[2];
let pose = 0,
  light = 0;
const N = 300;
for (let i = 0; i < N + 30; i++) {
  const t = ((i * 7) % 720) / 60;
  const a = performance.now();
  stage.pose(t);
  const b = performance.now();
  stage.light(-2.7, -1.2, [-0.65, 0.53, -0.55]);
  const c = performance.now();
  if (i >= 30) {
    pose += b - a;
    light += c - b;
  }
}
console.log(`${stage.count} drawn: pose ${(pose / N).toFixed(2)} ms, light ${(light / N).toFixed(2)} ms`);
