# Codevember 2026 — Eighteen Days

The repository of the November daily series, as Yuri Artiukh builds it: eighteen `NN-name` folders, each an
experiment with its own dependencies and its own Vite build, plus a gallery page that lists all thirty prompts and
links the days that exist. A sheet folding, glass shattering, wax melting, threads tangling, a moss garden, a brass
orrery, satin primitives, a neon tesseract, standing waves, a sunken observatory, rust, feathers, a maze, chains,
a mirage, a spore, a kelp forest and a pendulum — built into `/1/`, `/2/` and so on.

## Run it

```bash
npm run build     # installs and builds every day into dist/, and writes dist/index.html
npm run preview
```

`scripts/build.mjs` runs `npm ci` and `vite build` in each day, adds a footer that links back to the gallery, and
never commits build output. The blender bakes, SDF volumes and baked textures travel with the days they belong to.

**Stack:** three.js · Vite · GLSL · TSL

## The studies above

The single-day WebGL studies further up this shelf are the published cuts of the same November; eleven of the
twelve share a day with this repository. This is the repository behind those shared days: the sources, the build
files and the assets, for the eighteen days that exist here.

## Credits

Yuri Artiukh ([akella](https://github.com/akella)), live at
[akella.github.io/codevember-2026](https://akella.github.io/codevember-2026/). Kept with the credit intact.

---

Part of [Paper](../README.md) — a library of self-contained interface pieces.
