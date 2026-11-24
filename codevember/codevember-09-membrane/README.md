# Membrane

A slice of a life form, under the microscope, and its death: a ring of jelly blocks, each with a small dark core,
between two thin blurry films, holding a thick, marbled fluid with a nucleus, vesicles and the inclusions it carries.

Part of the [paper-widgets](../README.md) shelf — one of twelve studies from
[Codevember 2026](https://grgrdvrt.com/works/codevember-2026/).

## Run it

Open `index.html`. Nothing to install. Three.js comes from a CDN, so the first load needs a connection.

```bash
npm run dev -- codevember-09-membrane
```

## The controls

- **Grab the cell and pull**; pull hard or **double click** to tear it.
- **Drag around it** to tilt; **wheel, pinch, + − or 0** to zoom.
- **k** kills the cell, **r** makes a new one, **space** pauses, **m** toggles sound, **h** hides the bar.

## How it works

The fluid is a continuum on a grid (`fluid.js`, `sim.js`); the films, the hairs and the inclusions are drawn around
it; `sound.js` makes the room hum and the tear audible.

## Source

Published at <https://grgrdvrt.com/works/codevember-2026/09_membrane/>, kept as it was published, with the credit intact.
