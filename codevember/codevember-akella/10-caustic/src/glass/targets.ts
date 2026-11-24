/**
 * The pictures hidden in the glass, drawn on a square canvas: white is where the light should go.
 * Everything is drawn in a unit square scaled to the canvas.
 */
export const TARGETS = ["eye", "skull", "word"] as const;
export type TargetName = (typeof TARGETS)[number];

type Ctx = OffscreenCanvasRenderingContext2D;

const eye = (c: Ctx) => {
  // the almond of the eye, its lids drawn bright
  const lid = (fill: boolean) => {
    c.beginPath();
    c.moveTo(0.1, 0.52);
    c.bezierCurveTo(0.3, 0.2, 0.7, 0.2, 0.9, 0.5);
    c.bezierCurveTo(0.7, 0.8, 0.3, 0.8, 0.1, 0.52);
    c.closePath();
    if (fill) c.fill();
    else c.stroke();
  };
  c.fillStyle = "rgba(255,255,255,0.42)";
  lid(true);
  // iris: a bright ring with spokes, around a dark pupil
  const g = c.createRadialGradient(0.5, 0.5, 0.04, 0.5, 0.5, 0.19);
  g.addColorStop(0, "#000");
  g.addColorStop(0.42, "#000");
  g.addColorStop(0.5, "#fff");
  g.addColorStop(0.8, "#bbb");
  g.addColorStop(0.97, "#fff");
  g.addColorStop(1, "#222");
  c.fillStyle = g;
  c.beginPath();
  c.arc(0.5, 0.5, 0.19, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = "rgba(0,0,0,0.55)";
  c.lineWidth = 0.006;
  for (let k = 0; k < 28; k++) {
    const a = (k / 28) * Math.PI * 2;
    c.beginPath();
    c.moveTo(0.5 + Math.cos(a) * 0.1, 0.5 + Math.sin(a) * 0.1);
    c.lineTo(0.5 + Math.cos(a) * 0.17, 0.5 + Math.sin(a) * 0.17);
    c.stroke();
  }
  // catchlight
  c.fillStyle = "#fff";
  c.beginPath();
  c.arc(0.45, 0.44, 0.03, 0, Math.PI * 2);
  c.fill();
  // lids and lashes
  c.strokeStyle = "#fff";
  c.lineWidth = 0.022;
  c.lineCap = "round";
  lid(false);
  c.lineWidth = 0.012;
  for (let k = 0; k <= 9; k++) {
    const s = 0.12 + k * 0.085;
    const x = 0.1 + s * 0.8;
    const y = 0.52 - Math.sin(s * Math.PI) * 0.24;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x + (x - 0.5) * 0.12, y - 0.07);
    c.stroke();
  }
  // brow
  c.lineWidth = 0.03;
  c.beginPath();
  c.moveTo(0.14, 0.24);
  c.quadraticCurveTo(0.5, 0.06, 0.86, 0.22);
  c.stroke();
};

const skull = (c: Ctx) => {
  const bone = c.createRadialGradient(0.44, 0.32, 0.05, 0.5, 0.45, 0.42);
  bone.addColorStop(0, "#fff");
  bone.addColorStop(1, "#8a8a8a");
  c.fillStyle = bone;
  // cranium, cheeks and jaw
  c.beginPath();
  c.ellipse(0.5, 0.4, 0.31, 0.3, 0, 0, Math.PI * 2);
  c.fill();
  c.beginPath();
  c.moveTo(0.25, 0.5);
  c.quadraticCurveTo(0.24, 0.66, 0.34, 0.7);
  c.lineTo(0.35, 0.86);
  c.quadraticCurveTo(0.5, 0.93, 0.65, 0.86);
  c.lineTo(0.66, 0.7);
  c.quadraticCurveTo(0.76, 0.66, 0.75, 0.5);
  c.closePath();
  c.fill();
  // sockets, nose, teeth
  c.fillStyle = "#000";
  for (const x of [0.38, 0.62]) {
    c.beginPath();
    c.ellipse(x, 0.5, 0.085, 0.075, x < 0.5 ? 0.25 : -0.25, 0, Math.PI * 2);
    c.fill();
  }
  c.beginPath();
  c.moveTo(0.5, 0.58);
  c.lineTo(0.46, 0.68);
  c.quadraticCurveTo(0.5, 0.7, 0.54, 0.68);
  c.closePath();
  c.fill();
  c.lineWidth = 0.012;
  c.strokeStyle = "#000";
  c.beginPath();
  c.moveTo(0.37, 0.79);
  c.quadraticCurveTo(0.5, 0.82, 0.63, 0.79);
  c.stroke();
  for (let k = 0; k < 7; k++) {
    const x = 0.395 + k * 0.035;
    c.beginPath();
    c.moveTo(x, 0.74);
    c.lineTo(x, 0.85);
    c.stroke();
  }
  // a crack across the brow
  c.lineWidth = 0.008;
  c.beginPath();
  c.moveTo(0.6, 0.13);
  c.lineTo(0.57, 0.2);
  c.lineTo(0.61, 0.25);
  c.lineTo(0.58, 0.33);
  c.stroke();
};

const word = (c: Ctx) => {
  c.fillStyle = "#fff";
  c.textAlign = "center";
  c.textBaseline = "middle";
  // tiny font sizes get clamped, so set the type in real pixels
  const res = c.canvas.width;
  c.save();
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.font = `900 ${Math.round(res * 0.2)}px Helvetica, Arial, sans-serif`;
  const w = c.measureText("CAUSTIC").width;
  c.translate(res * 0.5, res * 0.5);
  c.scale((res * 0.88) / w, ((res * 0.88) / w) * 1.5);
  c.fillText("CAUSTIC", 0, 0);
  c.restore();
  // thin rules above and below
  c.fillRect(0.06, 0.31, 0.88, 0.012);
  c.fillRect(0.06, 0.678, 0.88, 0.012);
};

export const drawTarget = (name: TargetName, res: number) => {
  const canvas = new OffscreenCanvas(res, res);
  const c = canvas.getContext("2d")!;
  c.fillStyle = "#000";
  c.fillRect(0, 0, res, res);
  c.scale(res, res);
  ({ eye, skull, word })[name](c);
  const data = c.getImageData(0, 0, res, res).data;
  const out = new Float32Array(res * res);
  for (let k = 0; k < out.length; k++) out[k] = (0.2126 * data[4 * k] + 0.7152 * data[4 * k + 1] + 0.0722 * data[4 * k + 2]) / 255;
  return out;
};
