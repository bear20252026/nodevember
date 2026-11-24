import "./lib/modulepreload-polyfill.js";
const n =
    "Fold Shatter Melt Tangle Moss Orrery Hollow Tesseract Membrane Caustic Rust Feather Labyrinth Tension Mirage Spore Kelp Pendulum Erosion Cocoon Bolt Echo Magma Nest Veil Anamorph Burrow Hive Portal Dissolve".split(
      " ",
    ),
  o = new Set([
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21,
    22, 23,
  ]);
document.querySelector("#count").textContent = `${o.size} of ${n.length}`;
const a = (s) => String(s + 1).padStart(2, "0");
document.querySelector("#days").innerHTML = n
  .map((s, e) =>
    o.has(e + 1)
      ? `<li><a class="tile" href="./days/${a(e)}-${s.toLowerCase()}/"><span class="frame"><img src="./thumbs/${a(e)}.jpg" alt="" loading="lazy" /></span><span class="caption"><span class="n">${a(e)}</span><span>${s}</span></span></a></li>`
      : "",
  )
  .join("");
document.querySelector("#soon").innerHTML =
  "Still to come &nbsp; " +
  n
    .map((s, e) => (o.has(e + 1) ? "" : `<span><b>${a(e)}</b>${s}</span>`))
    .join("");
