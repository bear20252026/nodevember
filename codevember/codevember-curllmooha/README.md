# Codevember 2026 — Twenty-Three Days

[curllmooha](https://www.curllmooha.com)'s Codevember 2026, as deployed at
[codevember-26.vercel.app](https://codevember-26.vercel.app/): twenty-three of the thirty November prompts, each a
WebGPU scene with its own live controls, textures, models and sound.

This folder is an editable reconstruction of the public deployment, not the author's original repository. The
deployed Vite bundle carried no source maps; the twenty-three page entries, shared modules, fracture worker, textures,
audio, GLB models and SDF data were recovered from it, unhashed, renamed and rewired into this multi-page Vite
project. The logic is the author's; the file layout and module names are the reconstruction's. Days 24–30 were not
published at the time of the snapshot and are not invented here.

It is a different set from the twelve WebGL studies already on the shelf: these are curllmooha's deployed WebGPU
pieces, with their own stage, materials, controls and assets.

## The twenty-three days

| # | Prompt | The piece |
|---:|---|---|
| 01 | Fold | A sheet of paper folding in half forever, and never getting smaller. |
| 02 | Shatter | Pull back a launcher; the first hit cracks it, the second brings it down, and it can all be rewound. |
| 03 | Melt | Three scoops in a waffle cone, slowly melting. |
| 04 | Tangle | Three balls of wool in one knot, on a blanket under a lamp at night. |
| 05 | Moss | A soft moss cushion with glass marbles resting in it. |
| 06 | Orrery | A gravity-well orrery: marble planets orbit an engraved brass funnel, spiral into the sun and are lifted back. |
| 07 | Hollow | An Earth with one glowing polar opening; fly inside to a molten world and a dripping core. |
| 08 | Tesseract | A sapphire crystal that opens onto a repeating tunnel of blue light. |
| 09 | Membrane | Stretch a translucent membrane and watch air bubbles drift through the gel. |
| 10 | Caustic | Drip acid on a sculpture in silver, gold, plastic or marble and watch it fizz, stain and etch. |
| 11 | Rust | A wooden chest weathers as rust spreads across its iron fittings. |
| 12 | Feather | A round creature thatched with thousands of feathers: click to puff it up, hold to blow air through the coat. |
| 13 | Labyrinth | Ants loose in a sand labyrinth, finding the shortest route by scent; knock walls down and they reroute. |
| 14 | Tension | Orb webs strung across the morning, glinting with dew, stretching under flies, leaves and raindrops. |
| 15 | Mirage | On foot in a dune sea at noon, walking toward water that holds the sky and stays exactly as far away. |
| 16 | Spore | An interactive macro study of one mushroom, seen from beneath its cap. |
| 17 | Kelp | A giant kelp forest seen from the reef, swaying in the swell under Snell's window. |
| 18 | Pendulum | Perfect-fit pendulums: every part meets its gap on time, forever. |
| 19 | Erosion | A block of land worn by a hundred thousand raindrops, live. |
| 20 | Cocoon | An articulated maple lantern casting moving shadows. |
| 21 | Bolt | Fly through the inside of a thunderstorm while lightning fires around you; click to call a strike. |
| 22 | Echo | A pitch-black cave that appears only where the echo of a click passes; click to send one. |
| 23 | Magma | A glowing lump of lava with a cracked black crust, smoking in the dark; drag to orbit, click to crack it open. |

## Run it

```bash
npm install
npm run dev                  # the gallery and the day pages on Vite's dev server
```

From the shelf root the same piece starts with:

```bash
npm run dev -- codevember-curllmooha
```

To build it:

```bash
npm run build                # dist/, with assets under /assets
npm run build -- --base=./   # dist/ for a subfolder, the way the shelf builds it
npm run preview
```

The project is a Vite multi-page app: `index.html` is the gallery, `days/01-fold/index.html` through
`days/23-magma/index.html` are the day pages, and all twenty-four entries are listed in `vite.config.js`.

## Where things are

```text
index.html                     the gallery
days/NN-name/index.html        one page per day, with its own inline styles
src/main.js                    the gallery entry
src/days/NN-name.js            one scene per day
src/lib/                       shared stage, three, leva and studio modules
src/workers/fracture-worker.js the fracture worker
src/assets/                    textures, audio, GLB models and SDF data
public/thumbs/                 the gallery thumbnails
```

`CATALOG.md` lists the twenty-three published pages and the unpublished prompts; `MAPPING.md` maps the deployed asset
names to the editable paths.

## Credit

Code and artwork © curllmooha (Vipin Pathak). No licence was published with the deployment. The piece is kept for
reading and learning with the credit intact; redistribute or use it commercially only with the author's permission.
