# Codevember 2026

Seventeen of November's thirty prompts, as [mrdoob](https://github.com/mrdoob) keeps them in the repository: each
day a folder of ES modules with its own page, preview and notes, and the gallery in `index.html` listing them all.
WebGPU, three.js TSL, built in code — no model downloads, nothing but the CDN at run time.

| # | Piece | What it is |
|---|---|---|
| 01 | Fold | A translucent plastic sheet folding endlessly onto itself. |
| 02 | Shatter | Glass shapes fall and shatter into fragments. |
| 03 | Melt | A melting wax sculpture. |
| 04 | Tangle | A handful of wandering threads, a growing tangle. |
| 05 | Moss | A floating moss garden with three companion stones, grown leaf by leaf and lit by fireflies. |
| 06 | Orrery | A sunlit brass orrery on travertine; procedural TSL surfaces, coloured glass, screen-space GI. |
| 07 | Hollow | An endless journey through eleven satin-metal primitives with polished edges. |
| 08 | Tesseract | A neon tesseract in a dark industrial space — a love letter to Nonotak. |
| 09 | Membrane | Standing waves through white sand and flowing soap. |
| 10 | Caustic | A sunken observatory of light. |
| 11 | Rust | A corroded underwater mine on a chain; drag it upward until the iron gives way. |
| 12 | Feather | Downy feathers falling through the last light above a wheat field. |
| 13 | Labyrinth | An endless winter night inside a snowbound hedge maze. |
| 14 | Tension | Interlocked steel chains pull tight, recoil and fracture. |
| 15 | Mirage | A procedurally eroded sandstone world, drawn with WebGPU meshlets. |
| 16 | Spore | Translucent amber mushroom fins above glowing moss, with drifting GPU spores. |
| 17 | Kelp | A drifting journey through a giant kelp forest, drawn with WebGPU meshlets. |

Part of the [paper-widgets](../README.md) shelf. The twelve Codevember studies already on the shelf — Fold, Shatter,
Tangle, Moss, Orrery, Hollow, Membrane, Caustics, Feather, Tension, Kelp, Bolt — are the WebGL cut published on
[grgrdvrt.com](https://grgrdvrt.com/works/codevember-2026/); all but Bolt are also among this repository's seventeen
WebGPU days. Bolt, from day 21, belongs to the later prompts and is kept beside them. Different days, different
code, both kept.

## Run it

Serve the folder over HTTP — the days are ES modules and will not load from `file://`:

```bash
npx serve codevember-2026
# or: python3 -m http.server 8026 --bind 127.0.0.1
```

Open the gallery, or a day directly (`/03/`). Needs a WebGPU-capable browser — a recent Chrome, Edge or Safari.
three.js comes from a CDN in each day's import map.

## What is kept

The repository as published: `01/` … `17/`, `gallery.css`, `index.html`, `LICENSE`, mrdoob's own README
(`README.upstream.md`) and a `README.md` in each day folder. The pages, their fonts and their previews are
untouched.

## Source

<https://github.com/mrdoob/codevember-2026> — live gallery at <https://mrdoob.github.io/codevember-2026/>.
MIT © 2026 mrdoob; the licence is kept in `LICENSE`.
