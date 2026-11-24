const n = {
    Workshop: {
      sweep: 13946306,
      key: [-0.75, 0.62, 0.32],
      keyColor: 16773602,
      keyLevel: 4.4,
      soft: 4,
      env: 0.5,
      fill: 14673653,
    },
    Overcast: {
      sweep: 14342613,
      key: [0.15, 1, 0.25],
      keyColor: 16185595,
      keyLevel: 3.2,
      soft: 14,
      env: 0.72,
      fill: 15921906,
    },
    Spotlit: {
      sweep: 12762033,
      key: [0.5, 0.88, 0.42],
      keyColor: 16774890,
      keyLevel: 5.2,
      soft: 2,
      env: 0.38,
      fill: 14213360,
    },
    Window: {
      sweep: 13686232,
      key: [-0.94, 0.36, 0.08],
      keyColor: 15660031,
      keyLevel: 4.6,
      soft: 5,
      env: 0.52,
      fill: 16772829,
    },
    Clay: {
      sweep: 13149841,
      key: [0.62, 0.56, 0.58],
      keyColor: 16771023,
      keyLevel: 4.3,
      soft: 5,
      env: 0.5,
      fill: 14739711,
    },
    Concrete: {
      sweep: 12171963,
      key: [-0.4, 0.9, 0.62],
      keyColor: 16777215,
      keyLevel: 4.6,
      soft: 6,
      env: 0.5,
      fill: 15659768,
    },
  },
  s = Object.keys(n);
function y(f, o) {
  const e = f.get("studio"),
    t = s.includes(e) ? e : "Original";
  return (
    t !== "Original" && o(n[t]),
    {
      value: t,
      options: ["Original", ...s],
      onChange: (l, r, { initial: i }) => {
        i || o(n[l] ?? null);
      },
    }
  );
}
function k(f) {
  const o = Math.hypot(...f.key);
  return f.key.map((e) => e / o);
}
function c(f) {
  return [16, 8, 0].map((o) => {
    const e = ((f >> o) & 255) / 255;
    return e <= 0.04045 ? e / 12.92 : ((e + 0.055) / 1.055) ** 2.4;
  });
}
export { s as S, k as a, c as b, n as c, y as s };
