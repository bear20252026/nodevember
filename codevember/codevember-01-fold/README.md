# Fold

A flat grid grows, folds seven times and is cut in two. The halves swing open like the pages of a book, showing
their cut faces. The material is soft candy gum in pastel layers, lit by one warm key light; the shadow falls only
on the floor.

Part of the [paper-widgets](../README.md) shelf — one of twelve studies from
[Codevember 2026](https://grgrdvrt.com/works/codevember-2026/).

## Run it

Open `index.html`. Nothing to install. Three.js comes from a CDN, so the first load needs a connection.

```bash
npm run dev -- codevember-01-fold
```

## The controls

- **Drag** to orbit; the camera also turns on its own until the slice arrives.
- **`?seed=n`** makes the sequence of folds reproducible; **`?t=seconds`** fast-forwards the animation.

## How it works

The grid is grown, folded in the vertex shader and cut by a plane; `slice.js` builds the two cut faces, each a
square masked by an alpha map and painted flat like the cut face of a solid (`fold.js`, `cull.js`, `palettes.js`,
`pattern.js`).

## Source

Published at <https://grgrdvrt.com/works/codevember-2026/01_fold/>, kept as it was published, with the credit intact.
