// Textures painted on canvases: the planets (painted wooden or ivory balls, as
// on an old orrery), the woods of the room, the engraved zodiac ring.
import * as THREE from 'three';
import { noise3, fbm, smoothstep, clamp, mix } from './noise.js';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}
function toTexture(c, srgb = true, repeat = false) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
const lerp3 = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];
const hex = (h) => [(h >> 16) & 255, (h >> 8) & 255, h & 255];

// an equirectangular map, its colour from a function of the point on the sphere
function sphereMap(w, h, fn) {
  const c = canvas(w, h);
  const g = c.getContext('2d');
  const img = g.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    const lat = (0.5 - (y + 0.5) / h) * Math.PI;
    for (let x = 0; x < w; x++) {
      const lon = ((x + 0.5) / w) * Math.PI * 2;
      const px = Math.cos(lat) * Math.cos(lon), py = Math.sin(lat), pz = Math.cos(lat) * Math.sin(lon);
      const col = fn(px, py, pz, lat);
      const i = (y * w + x) * 4;
      img.data[i] = clamp(col[0], 0, 255);
      img.data[i + 1] = clamp(col[1], 0, 255);
      img.data[i + 2] = clamp(col[2], 0, 255);
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return toTexture(c);
}

// bands across the latitudes, wavy, of a few colours
function banded(seed, colors, opts = {}) {
  const n = noise3(seed);
  const { freq = 9, warp = 0.35, turb = 0.15, spot } = opts;
  return sphereMap(512, 256, (x, y, z, lat) => {
    const w = fbm(n, x * 2.2, y * 2.2, z * 2.2, 4) * warp;
    const v = Math.sin(lat * freq + w * 3 + fbm(n, x * 7, y * 30, z * 7, 3) * turb * 3);
    const v2 = Math.sin(lat * freq * 2.3 + w * 5 + 1.3);
    let t = clamp(v * 0.5 + 0.5 + v2 * 0.18);
    const k = t * (colors.length - 1);
    const i = Math.min(colors.length - 2, Math.floor(k));
    let col = lerp3(colors[i], colors[i + 1], k - i);
    if (spot) {
      // a great oval storm
      const d = Math.hypot((Math.atan2(z, x) - spot[0]) * 0.55, (lat - spot[1]) * 1.4);
      col = lerp3(col, spot[2], smoothstep(0.16, 0.08, d) * 0.85);
    }
    const g = 1 + fbm(n, x * 18, y * 18, z * 18, 2) * 0.06;
    return col.map((c) => c * g);
  });
}

// maps from the space probes, equirectangular, 2048 × 1024: Solar System
// Scope (CC BY 4.0), from NASA / USGS mosaics
const loader = new THREE.TextureLoader();
const src = (name) => new URL(`./tex/${name}.jpg`, import.meta.url).href;
function photo(name) {
  const t = loader.load(src(name));
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// the Earth, painted as the other balls are, but on the real continents:
// their outline from a land / sea map (earth_land.jpg: the sea white, from
// NASA's Blue Marble by way of the three.js examples). Painted once the map
// is in; till then, a blank ball.
function paintedEarth(w = 1024, h = 512) {
  const c = canvas(w, h);
  const t = toTexture(c);
  const n = noise3(23);
  const img = new Image();
  img.onload = () => {
    // the sea, read twice: sharp for the coasts, broad for the shallows
    const read = (blur) => {
      const m = canvas(w, h).getContext('2d', { willReadFrequently: true });
      m.filter = `blur(${blur}px)`;
      m.drawImage(img, 0, 0, w, h);
      return m.getImageData(0, 0, w, h).data;
    };
    const sharp = read(0.8), broad = read(7);
    const g = c.getContext('2d');
    const out = g.createImageData(w, h);
    const LAND0 = hex(0x7a8a4a), LAND1 = hex(0xb8935a), DEEP = hex(0x1d3a5c), SHOAL = hex(0x2f5c80), ICE = hex(0xece6d6);
    for (let y = 0; y < h; y++) {
      const lat = (0.5 - (y + 0.5) / h) * Math.PI;
      for (let x = 0; x < w; x++) {
        const lon = ((x + 0.5) / w) * Math.PI * 2;
        const px = Math.cos(lat) * Math.cos(lon), py = Math.sin(lat), pz = Math.cos(lat) * Math.sin(lon);
        const i = (y * w + x) * 4;
        const land = smoothstep(0.62, 0.38, sharp[i] / 255);
        const shelf = 1 - broad[i] / 255; // near land
        const v = fbm(n, px * 1.7, py * 1.7, pz * 1.7, 5) + fbm(n, px * 6, py * 6, pz * 6, 2) * 0.3;
        const ground = lerp3(LAND0, LAND1, smoothstep(-0.35, 0.45, v));
        const sea = lerp3(DEEP, SHOAL, clamp(shelf * 1.6 + v * 0.25));
        let col = lerp3(sea, ground, land);
        // the coast drawn a little darker, as on a painted globe
        col = col.map((cc) => cc * (1 - (1 - Math.abs(land - 0.5) * 2) * 0.22));
        col = lerp3(col, ICE, smoothstep(1.15, 1.32, Math.abs(lat)));
        out.data[i] = col[0];
        out.data[i + 1] = col[1];
        out.data[i + 2] = col[2];
        out.data[i + 3] = 255;
      }
    }
    g.putImageData(out, 0, 0);
    t.needsUpdate = true;
  };
  img.src = src('earth_land');
  return t;
}

let photos;
function photoTextures() {
  return (photos ??= { earth: paintedEarth(), moon: photo('moon'), mars: photo('mars') });
}

// what a ball's material takes besides its map: the relief
export function surface(tex, name) {
  if (name === 'mars') return { bumpMap: tex.mars, bumpScale: 1.2 };
  if (name === 'moon') return { bumpMap: tex.moon, bumpScale: 1.5 };
  return {};
}

export function planetTextures() {
  const N = (seed) => noise3(seed);
  const n1 = N(11);
  return {
    mercury: sphereMap(256, 128, (x, y, z) => {
      const t = fbm(n1, x * 3, y * 3, z * 3, 5);
      const crater = Math.abs(fbm(n1, x * 9 + 4, y * 9, z * 9, 3));
      return lerp3(hex(0x8b8178), hex(0xc7b9a6), smoothstep(-0.5, 0.6, t)).map((c) => c * (0.85 + crater * 0.3));
    }),
    venus: banded(5, [hex(0xd9b77c), hex(0xf0dcae), hex(0xc99a5a), hex(0xe8cf98)], { freq: 4, warp: 0.9, turb: 0.4 }),
    // the Moon and Mars from photographs (see tex/), with their relief,
    // sharper than paint; the Earth painted on its real continents
    ...photoTextures(),
    jupiter: banded(7, [hex(0x8c5a38), hex(0xe2c9a0), hex(0xb7804e), hex(0xf2e2c2), hex(0xa36a42)], {
      freq: 11, warp: 0.25, turb: 0.25, spot: [1.2, -0.38, hex(0xb0442a)],
    }),
    saturn: banded(9, [hex(0xb88c52), hex(0xe9d3a0), hex(0xcfa868), hex(0xf1e2bb)], { freq: 8, warp: 0.2, turb: 0.12 }),
    // Herschel's planet: pale sea-green, its bands barely there
    uranus: banded(17, [hex(0x8fb8b0), hex(0xb4d3c8), hex(0x9cc2ba), hex(0xc6ddd2)], { freq: 6, warp: 0.15, turb: 0.06 }),
    // the big planet in the sky: the same, finer
    giant: banded(13, [hex(0x9a6e3e), hex(0xe7cf98), hex(0xc2914f), hex(0xf4e4bc), hex(0xb0824c)], { freq: 14, warp: 0.3, turb: 0.25 }),
  };
}

// rings: rows of concentric bands with gaps (u = across the ring)
export function ringTexture(seed = 3) {
  const w = 512;
  const c = canvas(w, 4);
  const g = c.getContext('2d');
  const n = noise3(seed);
  for (let x = 0; x < w; x++) {
    const u = x / w;
    let a = 0.55 + n(u * 40, 0.5, 0.5) * 0.5 + n(u * 140, 1.5, 0.5) * 0.3;
    a *= smoothstep(0.0, 0.06, u) * smoothstep(1.0, 0.92, u);
    a *= 1 - smoothstep(0.03, 0.0, Math.abs(u - 0.62)) * 0.92; // the Cassini division
    a *= 1 - smoothstep(0.02, 0.0, Math.abs(u - 0.86)) * 0.6;
    a = clamp(a);
    const b = 0.75 + n(u * 60, 3.5, 0.5) * 0.4;
    g.fillStyle = `rgba(${(226 * b) | 0},${(196 * b) | 0},${(142 * b) | 0},${a})`;
    g.fillRect(x, 0, 1, 4);
  }
  return toTexture(c);
}

// wood: long grain along y, dark and warm
export function woodTexture({ seed = 1, base = 0x4a2412, light = 0x7a4424, w = 512, h = 512, planks = 0, scale = 1 } = {}) {
  const c = canvas(w, h);
  const g = c.getContext('2d');
  const img = g.createImageData(w, h);
  const n = noise3(seed);
  const A = hex(base), B = hex(light);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let u = x / w, v = y / h;
      let plank = 0, off = 0;
      if (planks) {
        plank = Math.floor(u * planks);
        off = (plank * 0.37) % 1;
      }
      const ring = fbm(n, u * 6 * scale + plank * 3.1, (v + off) * 0.6 * scale, plank, 3);
      let t = Math.sin((u * 60 * scale + ring * 9) ) * 0.5 + 0.5;
      t = t * 0.5 + (fbm(n, u * 90 * scale, v * 4, plank + 7, 2) * 0.5 + 0.5) * 0.5;
      let col = lerp3(A, B, t);
      const tone = 0.85 + n(plank * 3.3, 0.5, 0.5) * 0.4;
      col = col.map((cc) => cc * tone);
      if (planks) {
        const e = Math.abs(((u * planks) % 1) - 0.5) * 2;
        const gap = smoothstep(0.96, 0.995, e);
        const vb = ((v + off * 2) * 3) % 1;
        const gap2 = smoothstep(0.985, 0.998, Math.abs(vb - 0.5) * 2);
        col = col.map((cc) => cc * (1 - Math.max(gap, gap2) * 0.8));
      }
      const i = (y * w + x) * 4;
      img.data[i] = col[0];
      img.data[i + 1] = col[1];
      img.data[i + 2] = col[2];
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return toTexture(c, true, true);
}

// the zodiac ring on top of the drum: degrees, the signs' names, between
// two engraved rules — drawn in polar coordinates on a square
export function zodiacTexture(size = 1024, inner = 0.72) {
  const c = canvas(size, size);
  const g = c.getContext('2d');
  const m = size / 2;
  g.fillStyle = '#fff';
  g.fillRect(0, 0, size, size);
  g.translate(m, m);
  const R = m * 0.995, r = m * inner;
  g.fillStyle = '#2a1808';
  g.strokeStyle = '#2a1808';
  // the rules
  for (const [rad, wdt] of [[R * 0.985, 3], [R * 0.93, 1.5], [R * 0.86, 1.5], [r * 1.04, 2], [r * 1.015, 1]]) {
    g.lineWidth = wdt;
    g.beginPath();
    g.arc(0, 0, rad, 0, Math.PI * 2);
    g.stroke();
  }
  // degrees
  for (let d = 0; d < 360; d++) {
    const a = (d / 360) * Math.PI * 2;
    const len = d % 30 === 0 ? R * 0.15 : d % 10 === 0 ? R * 0.07 : d % 5 === 0 ? R * 0.045 : R * 0.03;
    g.lineWidth = d % 30 === 0 ? 2.5 : 1.2;
    g.beginPath();
    g.moveTo(Math.cos(a) * R * 0.93, Math.sin(a) * R * 0.93);
    g.lineTo(Math.cos(a) * (R * 0.93 - len * 0.45), Math.sin(a) * (R * 0.93 - len * 0.45));
    g.stroke();
  }
  const signs = ['ARIES', 'TAURUS', 'GEMINI', 'CANCER', 'LEO', 'VIRGO', 'LIBRA', 'SCORPIO', 'SAGITTARIUS', 'CAPRICORNUS', 'AQUARIUS', 'PISCES'];
  g.font = `${Math.round(size * 0.026)}px Georgia, 'Times New Roman', serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const tr = (R * 0.86 + r * 1.04) / 2;
  signs.forEach((s, k) => {
    const a0 = (k / 12) * Math.PI * 2 + Math.PI / 12;
    const letters = s.split('');
    const spread = (size * 0.022) / tr; // about a letter's width, as an angle
    letters.forEach((ch, j) => {
      const a = a0 + (j - (letters.length - 1) / 2) * spread * 0.95;
      g.save();
      g.rotate(a + Math.PI / 2);
      g.fillText(ch, 0, -tr);
      g.restore();
    });
    // a little star between the signs
    const b = (k / 12) * Math.PI * 2;
    g.save();
    g.rotate(b);
    g.beginPath();
    for (let i = 0; i < 8; i++) {
      const rr = i % 2 ? size * 0.004 : size * 0.011;
      const aa = (i / 8) * Math.PI * 2;
      g.lineTo(tr + Math.cos(aa) * rr, Math.sin(aa) * rr);
    }
    g.fill();
    g.restore();
  });
  return toTexture(c);
}
