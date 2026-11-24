# Shatter

Solid volumes — glass, ice, wood, marble, stone, ceramic, obsidian — break into fragments. The camera zooms into the
core of each volume, where the next one is already waiting, so the sequence keeps falling inward.

Part of the [paper-widgets](../README.md) shelf — one of twelve studies from
[Codevember 2026](https://grgrdvrt.com/works/codevember-2026/).

## Run it

Open `index.html`. Nothing to install. Three.js comes from a CDN, so the first load needs a connection.

```bash
npm run dev -- codevember-02-shatter
```

## The controls

- **Drag** to orbit. The sequence turns as one, at a steady pace.
- **`?seed=n`** makes the sequence reproducible; **`?material=wood`** shows only that material; **`&hollow`** makes
  every volume hollow.

## How it works

`fracture.js` cuts the volumes into convex cells and builds the shells; `materials.js` renders the glass, ice, wood,
marble, stone and ceramic volumes, opaque or seen through; `particles.js` handles the dust and the light it catches.

## Source

Published at <https://grgrdvrt.com/works/codevember-2026/02_shatter/>, kept as it was published, with the credit intact.
