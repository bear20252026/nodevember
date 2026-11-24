/**
 * The creatures the light draws, as brush strokes in a 1000 x 1000 box (y down). A stroke is a list of
 * points the brush passes through (a smooth curve is run through them), and its weight. The brush
 * tapers at both ends of a stroke, as a pen does.
 */
export type Stroke = { pts: number[][]; w?: number; closed?: boolean };
export type Creature = { name: string; strokes: Stroke[] };

const ring = (cx: number, cy: number, rx: number, ry = rx, from = 0, to = Math.PI * 2, n = 24) => {
  const pts: number[][] = [];
  for (let k = 0; k <= n; k++) {
    const a = from + ((to - from) * k) / n;
    pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return pts;
};

const wavy = (x0: number, y0: number, len: number, amp: number, wl: number, phase: number, drift = 0, n = 30) => {
  const pts: number[][] = [];
  for (let k = 0; k <= n; k++) {
    const s = k / n;
    // the swing grows down the tentacle
    pts.push([x0 + Math.sin(phase + (s * len) / wl) * amp * (0.3 + s) + drift * s * s, y0 + s * len]);
  }
  return pts;
};

const fish: Creature = {
  name: "fish",
  strokes: [
    // back, from the snout to the tail
    { pts: [[835, 492], [790, 440], [700, 392], [590, 372], [470, 385], [360, 425], [265, 470], [205, 492]], w: 1.1 },
    // belly
    { pts: [[835, 500], [790, 548], [700, 600], [580, 622], [450, 605], [340, 565], [260, 525], [205, 508]], w: 1.1 },
    // tail fin
    { pts: [[208, 490], [160, 440], [95, 372], [112, 440], [128, 500], [112, 562], [92, 638], [160, 566], [208, 510]], w: 1 },
    { pts: [[180, 470], [130, 430]], w: 0.5 },
    { pts: [[180, 530], [128, 575]], w: 0.5 },
    // dorsal fin
    { pts: [[585, 374], [545, 300], [480, 262], [420, 300], [385, 405]], w: 0.9 },
    { pts: [[520, 300], [500, 378]], w: 0.45 },
    { pts: [[460, 290], [440, 385]], w: 0.45 },
    // pectoral and pelvic fins
    { pts: [[610, 545], [585, 610], [535, 650], [540, 600], [575, 555]], w: 0.8 },
    { pts: [[420, 602], [395, 655], [355, 672], [370, 620]], w: 0.7 },
    // gill
    { pts: [[680, 418], [652, 470], [650, 530], [678, 585]], w: 0.8 },
    // eye and mouth
    { pts: ring(752, 462, 15), w: 0.7 },
    { pts: [[835, 497], [800, 506]], w: 0.6 },
    // a few scales
    { pts: ring(560, 470, 30, 30, -1.2, 1.2, 10), w: 0.4 },
    { pts: ring(500, 520, 30, 30, -1.2, 1.2, 10), w: 0.4 },
    { pts: ring(440, 470, 30, 30, -1.2, 1.2, 10), w: 0.4 },
    { pts: ring(380, 515, 28, 28, -1.2, 1.2, 10), w: 0.4 },
  ],
};

const bird: Creature = {
  name: "bird",
  strokes: [
    // left wing, leading edge out to the tip and trailing edge back
    { pts: [[468, 468], [400, 425], [320, 380], [210, 335], [70, 300], [180, 368], [270, 420], [360, 470], [440, 515], [462, 535]], w: 1.1 },
    // right wing
    { pts: [[532, 468], [600, 425], [680, 380], [790, 335], [930, 300], [820, 368], [730, 420], [640, 470], [560, 515], [538, 535]], w: 1.1 },
    // head
    { pts: [[468, 470], [478, 432], [500, 412], [522, 432], [532, 470]], w: 1 },
    // forked tail
    { pts: [[462, 532], [468, 610], [430, 720], [478, 660], [500, 640], [522, 660], [570, 720], [532, 610], [538, 532]], w: 1 },
    // feathers
    { pts: [[180, 368], [205, 350]], w: 0.4 },
    { pts: [[270, 420], [292, 392]], w: 0.4 },
    { pts: [[360, 470], [375, 440]], w: 0.4 },
    { pts: [[820, 368], [795, 350]], w: 0.4 },
    { pts: [[730, 420], [708, 392]], w: 0.4 },
    { pts: [[640, 470], [625, 440]], w: 0.4 },
  ],
};

const jelly: Creature = {
  name: "jellyfish",
  strokes: [
    // the bell
    { pts: ring(500, 400, 190, 175, Math.PI, Math.PI * 2, 30), w: 1.2 },
    // scalloped rim
    {
      pts: Array.from({ length: 41 }, (_, k) => {
        const s = k / 40;
        return [310 + s * 380, 400 + Math.abs(Math.sin(s * Math.PI * 7)) * 22];
      }),
      w: 0.9,
    },
    // inner bell
    { pts: ring(500, 400, 110, 105, Math.PI * 1.08, Math.PI * 1.92, 20), w: 0.5 },
    // frilled arms
    { pts: wavy(470, 420, 330, 30, 45, 0, -30, 40), w: 1 },
    { pts: wavy(530, 420, 360, 34, 50, 2, 25, 40), w: 1 },
    // tentacles
    { pts: wavy(335, 412, 440, 22, 70, 1, -40), w: 0.5 },
    { pts: wavy(395, 420, 480, 26, 80, 3, -10), w: 0.5 },
    { pts: wavy(605, 420, 470, 24, 75, 0.5, 15), w: 0.5 },
    { pts: wavy(665, 412, 430, 22, 65, 2.4, 45), w: 0.5 },
  ],
};

export const creatures: Creature[] = [fish, bird, jelly];
