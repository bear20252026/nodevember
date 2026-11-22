# Nodevember 2026 · Day 20 · Smoke — Macro Creamy Milk-in-Rose-Water Plume

Date: 2026-11-22  ·  Folder: `2026/day20-smoke-v10-cream-plume`

## Idea
- **Reading of the prompt**: lateral tactile material study — dense creamy milk billowing underwater like macro liquid smoke in warm rose-tinted water.
- **One-sentence concept**: multi-nozzle dense cream plumes erupt through still rose-tinted water via a true 3D Navier-Stokes solver in Blender 5.3 Geometry Nodes, rolling into lush ivory mushroom-cap curls whose folded crevices glow warm peach-coral under 20-bounce Cycles volumetric multiple scattering.
- **Constraint**: 100% procedural in Blender 5.3 Geometry Nodes (native grid nodes: midpoint velocity advection, BFECC dye advection, vorticity confinement, dual-scale curl disturbance, and Fixed-boundary `Grid Solve Poisson`); no Mantaflow, no external OpenVDB bake, no image textures, no imported meshes.
- **Technique to learn or show off**:
  - High-resolution (~230³) multi-nozzle Rayleigh-Taylor / Kelvin-Helmholtz fluid simulation inside a Geometry Nodes Simulation Zone (`32` main-tree nodes + 6 modular teaching groups, `168` nodes total).
  - Energy-conserving `Principled Volume` with dual-regime density mapping (steep creamy milk core + soft diluted mist edge) and 20 volume bounces so deep crevices tint naturally into warm peach-rose without cyan spectral inversion or murky grey shadows.
  - Shallow macro telephoto framing (`90mm f/3.6`) with warm studio-aquarium backlighting.
- **Output**:
  - `render.png` — 1:1 `1080×1080` Cycles hero still (frame 64, 144 samples)
  - `loop.mp4` — 1:1 `720×720` slow-motion fluid billowing animation (frames 4–78 @ 24 fps, ~3.1 s)
  - `nodes.png` — clean modular overview of `PA_CreamPlume_GN` (3 sections + 6 helper groups)
  - `tutorial/README.md` — full node-by-node English walkthrough with cut-out screenshots, pipeline/timeline diagrams, storyboard, and optical/vorticity proof strips

## Files
- [x] `render.png` — Final `1080×1080` Cycles hero still (frame 64)
- [x] `render-048.png` — Mid-bloom still (frame 48)
- [x] `loop.mp4` — Slow-motion billowing animation (`720×720`, 75 frames @ 24 fps, ~3.1 s)
- [x] `nodes/` — Readable modular Geometry Nodes, material and world screenshots
- [x] `tutorial/README.md` — Node-by-node tutorial & diagram suite

## Captions

### Mastodon (358 / 500 chars)
```text
Nodevember 2026 · Day 20: Smoke | Cream Plume

Multi-nozzle Navier-Stokes milk-in-rose-water solver + 20-bounce Cycles Principled Volume

Rules: 100% Geometry Nodes stable fluids (grid nodes, no Mantaflow, no external VDB, no image textures)

Made with Blender 5.3 Geometry Nodes.

@Nodevember@graphics.social

#nodevember #nodevember2026 #GeometryNodes #b3d
```

### Bluesky (249 / 300 chars)
```text
Nodevember 2026 · Day 20: Smoke | Cream Plume

Multi-nozzle Navier-Stokes milk-in-rose-water solver + 20-bounce Cycles Principled Volume

Made with Blender 5.3 Geometry Nodes.

@nodevember.bsky.social

#nodevember #nodevember2026 #GeometryNodes #b3d
```

### X (237 / 280 chars)
```text
Nodevember 2026 · Day 20: Smoke | Cream Plume

Multi-nozzle Navier-Stokes milk-in-rose-water solver + 20-bounce Cycles Principled Volume

Made with Blender 5.3 Geometry Nodes.

@Nodevember

#nodevember #nodevember2026 #GeometryNodes #b3d
```

### Instagram (344 / 2200 chars)
```text
Nodevember 2026 · Day 20: Smoke | Cream Plume

Multi-nozzle Navier-Stokes milk-in-rose-water solver + 20-bounce Cycles Principled Volume

Rules: 100% Geometry Nodes stable fluids (grid nodes, no Mantaflow, no external VDB, no image textures)

Made with Blender 5.3 Geometry Nodes.

@nodevemberio

#nodevember #nodevember2026 #GeometryNodes #b3d
```

### Blender Artists
```text
TITLE: Nodevember 2026 · Day 20 · Smoke | Cream Plume
TAGS: nodevember, geometry-nodes, procedural

Multi-nozzle Navier-Stokes milk-in-rose-water solver + 20-bounce Cycles Principled Volume

Rules: 100% Geometry Nodes stable fluids (grid nodes, no Mantaflow, no external VDB, no image textures)

Made with Blender 5.3 Geometry Nodes (299 nodes).

Breakdown:
- True 3D incompressible stable-fluids solver in a Geometry Nodes Simulation Zone using Blender 5.3 grid nodes (midpoint velocity advection, BFECC dye advection, vorticity confinement, dual-scale curl disturbance, Fixed-boundary Grid Solve Poisson).
- 13 staggered nozzles (one broad hero billow + fine upper-left/lower micro-jets + soft background veil) driven by oblique Rayleigh-Taylor gravity.
- Dual-regime density transfer into an energy-conserving Principled Volume at 20 volume bounces so sunlit crests glow warm vanilla-ivory while folded crevices scatter into luminous peach-rose.
- Filmed with a shallow 90mm f/3.6 macro lens against a soft dusty-rose water backdrop.
```

## Alt text
Macro close-up of dense ivory-cream liquid smoke billowing from the left into soft dusty-rose water. Curled mushroom-like folds catch warm vanilla highlights while deep crevices glow soft peach-coral, fading into a dreamy out-of-focus blush haze on the right.

## Posting
- [ ] Mastodon (mention @Nodevember@graphics.social)
- [ ] Bluesky (@nodevember.bsky.social)
- [ ] X (@Nodevember)
- [ ] Instagram (@nodevemberio)
- [ ] Blender Artists (tag: nodevember)
- [ ] Posted
