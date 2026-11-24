// The oasis, drawn: three strips of date palms and scrub, one under another in one picture, to stand one behind
// another at the end of the lane. It is only ever seen from hundreds of metres, so flat screens will do.
// Every strip is 300 m of ground across and 37.5 m up (4096 x 512: 13.65 pixels to a metre both ways).

const W = 4096;
const H = 512;
const PPM = W / 300;

const rng = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

type C = CanvasRenderingContext2D;

function frond(
  c: C,
  x: number,
  y: number,
  a: number,
  long: number,
  droop: number,
  green: string,
  r: () => number,
) {
  // the rib: out at its angle (0 is straight up), bending down under its own weight
  const [dx, dy] = [Math.sin(a), -Math.cos(a)];
  const [mx, my] = [x + dx * long * 0.5, y + dy * long * 0.5 - long * 0.06];
  const [ex, ey] = [x + dx * long * 0.92, y + dy * long * 0.92 + long * droop];
  const at = (t: number) => [
    (1 - t) * (1 - t) * x + 2 * t * (1 - t) * mx + t * t * ex,
    (1 - t) * (1 - t) * y + 2 * t * (1 - t) * my + t * t * ey,
  ];
  c.strokeStyle = green;
  c.lineCap = "round";
  c.lineWidth = 1.5;
  c.beginPath();
  c.moveTo(x, y);
  c.quadraticCurveTo(mx, my, ex, ey);
  c.stroke();
  // leaflets off both sides of it, longest in the middle, hanging
  c.lineWidth = 1.05;
  c.beginPath();
  const n = Math.round(long / 2.1);
  for (let i = 2; i <= n; i++) {
    const t = i / n;
    const [px, py] = at(t);
    const [qx, qy] = at(Math.max(0, t - 0.03));
    const l = Math.hypot(px - qx, py - qy) || 1;
    const [tx, ty] = [(px - qx) / l, (py - qy) / l];
    const reach =
      0.82 *
      PPM *
      Math.sin(Math.PI * Math.pow(t, 0.75)) ** 0.7 *
      (0.75 + 0.5 * r());
    for (const side of [-1, 1]) {
      const lean = 0.55 + 0.25 * r();
      const [lx, ly] = [
        tx * lean - side * ty * (1 - lean),
        ty * lean + side * tx * (1 - lean),
      ];
      c.moveTo(px, py);
      c.lineTo(px + lx * reach, py + ly * reach + reach * 0.45);
    }
  }
  c.stroke();
}

function palm(
  c: C,
  x: number,
  base: number,
  tall: number,
  lean: number,
  r: () => number,
) {
  const [tx, ty] = [x + lean, base - tall];
  const [mx, my] = [x + lean * 0.15, base - tall * 0.55];
  // the trunk, thinner toward the top, ringed with old leaf bases
  const n = Math.ceil(tall / 3);
  for (let i = 0; i < n; i++) {
    const [t0, t1] = [i / n, (i + 1.3) / n];
    const p = (t: number) => [
      (1 - t) * (1 - t) * x + 2 * t * (1 - t) * mx + t * t * tx,
      (1 - t) * (1 - t) * base + 2 * t * (1 - t) * my + t * t * ty,
    ];
    const [a, b] = [p(t0), p(Math.min(1, t1))];
    c.strokeStyle = i % 2 ? "#4a3626" : "#5b4430";
    c.lineWidth = PPM * (0.52 - 0.2 * t0);
    c.lineCap = "butt";
    c.beginPath();
    c.moveTo(a[0], a[1]);
    c.lineTo(b[0], b[1]);
    c.stroke();
  }
  // the crown: old brown fronds hanging under, then green ones all round, the newest standing up
  const count = 20 + Math.floor(r() * 9);
  const long = PPM * (3.4 + 1.6 * r()) * Math.min(1, 0.55 + tall / (PPM * 22));
  for (let i = 0; i < 5; i++) {
    const side = r() < 0.5 ? -1 : 1;
    frond(
      c,
      tx,
      ty + 3,
      side * (1.9 + 0.7 * r()),
      long * (0.6 + 0.3 * r()),
      0.28,
      `hsl(${32 + 14 * r()}, ${30 + 15 * r()}%, ${22 + 8 * r()}%)`,
      r,
    );
  }
  const order = Array.from(
    { length: count },
    (_, i) => ((i + 0.5) / count) * 2 - 1,
  ).sort(() => r() - 0.5);
  for (const u of order) {
    const a = u * 1.85 + (r() - 0.5) * 0.25;
    const droop = 0.1 + 0.42 * Math.abs(u) ** 1.5 + 0.12 * r();
    frond(
      c,
      tx,
      ty,
      a,
      long * (0.8 + 0.3 * r()),
      droop,
      `hsl(${78 + 26 * r()}, ${34 + 20 * r()}%, ${15 + 15 * r()}%)`,
      r,
    );
  }
  c.fillStyle = "#3d2f20";
  c.beginPath();
  c.arc(tx, ty + 1, PPM * 0.36, 0, 7);
  c.fill();
}

function scrub(c: C, x: number, base: number, tall: number, r: () => number) {
  // a bush: a heap of soft blobs
  for (let i = 0; i < 26; i++) {
    const u = r() * 2 - 1;
    const v = r();
    const size = tall * (0.16 + 0.2 * r()) * (1 - 0.5 * v);
    c.fillStyle = `hsl(${68 + 34 * r()}, ${24 + 18 * r()}%, ${14 + 12 * r() + 6 * v}%)`;
    c.beginPath();
    c.ellipse(
      x + u * tall * 0.75 * (1 - 0.6 * v),
      base - v * tall * 0.85 - size * 0.4,
      size * 1.25,
      size,
      0,
      0,
      7,
    );
    c.fill();
  }
}

export function drawGrove(seed: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = 3 * H;
  const c = canvas.getContext("2d")!;
  for (let k = 0; k < 3; k++) {
    const r = rng(seed * 131 + k * 17 + 5);
    c.save();
    c.translate(0, k * H);
    c.beginPath();
    c.rect(0, 0, W, H);
    c.clip();
    const base = H - 0.4 * PPM;
    // more toward the middle of the strip than its ends, and in clumps
    const spot = () => {
      const g = (r() + r() + r()) / 3;
      return W * (0.5 + (g - 0.5) * 1.75);
    };
    const things: { x: number; draw: () => void }[] = [];
    const clumps = Array.from({ length: 9 }, () => spot());
    const palms = k === 1 ? 34 : 24;
    for (let i = 0; i < palms; i++) {
      const x =
        r() < 0.7
          ? clumps[Math.floor(r() * clumps.length)] + (r() - 0.5) * PPM * 26
          : spot();
      const tall = PPM * (7 + 13 * Math.pow(r(), 0.8));
      const lean = (r() - 0.5) * tall * 0.3;
      things.push({ x, draw: () => palm(c, x, base, tall, lean, r) });
    }
    for (let i = 0; i < 40; i++) {
      const x = spot() + (r() - 0.5) * 300;
      const tall = PPM * (1.2 + 3.2 * r() * r());
      things.push({ x, draw: () => scrub(c, x, base + 2, tall, r) });
    }
    // young palms: a crown with no trunk yet
    for (let i = 0; i < 14; i++) {
      const x = spot();
      things.push({
        x,
        draw: () => {
          for (let j = 0; j < 12; j++)
            frond(
              c,
              x,
              base - 4,
              (r() * 2 - 1) * 1.5,
              PPM * (1.6 + 1.6 * r()),
              0.12 + 0.2 * r(),
              `hsl(${80 + 24 * r()}, ${36 + 16 * r()}%, ${16 + 14 * r()}%)`,
              r,
            );
        },
      });
    }
    things.sort(() => r() - 0.5);
    for (const t of things) if (t.x > 40 && t.x < W - 40) t.draw();
    // grass along the foot of it all
    c.lineWidth = 1;
    for (let i = 0; i < 2600; i++) {
      const x = spot() + (r() - 0.5) * 500;
      const tall = PPM * (0.25 + 0.8 * r() * r());
      c.strokeStyle = `hsl(${60 + 40 * r()}, ${25 + 25 * r()}%, ${16 + 16 * r()}%)`;
      c.beginPath();
      c.moveTo(x, base + 4);
      c.lineTo(x + (r() - 0.5) * tall * 0.9, base + 4 - tall);
      c.stroke();
    }
    c.restore();
  }
  return canvas;
}
