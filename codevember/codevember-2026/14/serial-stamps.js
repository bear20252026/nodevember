import * as THREE from "three/webgpu";

export const SERIAL_ROWS = 64;

export function serialSlot(link, assembly) {
  return link % 4 === 1 ? (assembly * 19 + link) % SERIAL_ROWS : -1;
}

// White is the recessed part of the stamp. It only contributes to height;
// the numbers retain the same steel color and reflections as the link.
export function createSerialAtlas() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = SERIAL_ROWS * 64;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "white";
  ctx.font = "bold 52px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.filter = "blur(0.65px)";
  for (let i = 0; i < SERIAL_ROWS; i++) {
    const number = `14${String((i * 197 + 83) % 10000).padStart(4, "0")}`;
    ctx.fillText(number, 128, i * 64 + 32);
  }
  const atlas = new THREE.CanvasTexture(canvas);
  atlas.name = "Recessed serial-number height atlas";
  atlas.colorSpace = THREE.NoColorSpace;
  atlas.minFilter = THREE.LinearMipmapLinearFilter;
  return atlas;
}
