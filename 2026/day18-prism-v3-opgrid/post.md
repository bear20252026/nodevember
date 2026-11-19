# Nodevember 2026 · Day 18 · Prism

Date: 2026-11-19 (late entry for 11-18)

## Idea
- Reading of the prompt: an Op Art / kinetic-sculpture poster (the third take on Day 18, after an atmospheric-optics
  piece and a dark glass sculpture).
- One-sentence concept: **Twisted prism wall.** 28 tall glass bars with a 60° triangular section, twisted by a
  travelling wave and rolling 120° per loop, seen straight on through an orthographic camera on black. Behind them
  hangs a backdrop the camera cannot see: black, with a vertical white slit. Seen through the twisted glass, the slit
  becomes diagonal spectral ribbons and dotted white arcs.
- Constraint: one Geometry Nodes tree of 28 working nodes for the wall; no lamps, no coloured light, no image
  textures. Every colour is white light split by Blender 5.3's Principled BSDF dispersion.
- Technique: each bar's centre stored as an attribute before Realize Instances, so Vector Rotate can turn every
  vertex about its own bar's axis; one formula θ = roll + wave + fan for the whole wall; Edge Angle → Split Edges
  keeps the three corners sharp while the twisted faces are shaded smooth.
- Output: 8 s loop (192 frames, 24 fps, 1080², Cycles, 384 samples, no denoiser, pixel filter 1.0, no bloom), and
  the still `render.png` (frame 1, 512 samples).

## Build log
- An earlier isometric grid of 121 columns was dropped: with many glass layers behind each other the refraction turned
  muddy grey. A single layer of 28 bars means each line of sight crosses one bar, so the black stays clean.
- All fill lights were removed; the only light is the hidden slit screen (Camera ray visibility off, so the gaps
  between the bars and the margin stay black).
- The slit screen stands in the XZ plane and its Mapping turns the coordinates 24° about Z; on that plane the turn
  only stretches and shifts the slits (2.85 m apart, the nearest at x = +0.646 m). They stay vertical: every diagonal
  in the picture is made by the twisted bars.
- Seam: the roll is a third of a turn per loop, which maps an equilateral triangle onto itself. Matching vertices of
  frame 1 to frame 192 gives a largest move of 3.21 mm, against 3.05 mm between frames 100 and 101.
- The bars are packed closer (0.139 m) than a face is wide (0.152 m): 27–45 % of neighbouring rings overlap at any
  moment, by up to 15 mm. Cycles treats each surface on its own, and the picture barely changes when the bars are
  thinned until nothing touches (Prism Radius 0.076).
- For the tutorial the tree was regrouped into 6 labelled sections; the scene, every node value, the materials and the
  evaluated mesh at five frames are identical before and after. Audit: strictly procedural, no issues.

## Exposed parameters
- `Columns` 28 · `Prism Radius` 0.088 · `Wall Height` 3.94 · `Twist Strength` 0.78 · `Wave Phase` 0.68

## Files
- [x] loop.mp4 (192 frames, 8 s, 24 fps, 1080², H.264)
- [x] render.png (frame 1, 512 samples), render-097.png (frame 97, 384 samples)
- [x] nodes/: main.png (1 Loop Clock → 2 One Prism Bar → 3 Array and Tag Centres → 4 Twist Angle → 5 Twist Each Bar
  → 6 Sharp Ridges, Smooth Faces), backdrop, light-blade, glass, loop-clock
- [x] tutorial/README.md (node-by-node walkthrough: node shots, twist-angle maps, cross-sections, A/B renders)

## Caption

### Mastodon
```
Nodevember 2026 · Day 18: Prism | Twisted Prism Wall

28 twisting 60° glass bars roll 120° in an Op Art wave in front of one hidden white slit. Every rainbow ribbon and dotted white arc is that slit, refracted and dispersed in Cycles 5.3.

Rules: 100% procedural (28 GN nodes), no lamps, no coloured light, no image textures.

Made with Blender Geometry Nodes + Cycles.

@Nodevember@graphics.social

#nodevember #nodevember2026 #GeometryNodes #b3d
```

### Bluesky / X
```
Nodevember 2026 · Day 18: Prism | Twisted Prism Wall

28 twisting 60° glass bars + 1 hidden white slit. No lamps, no coloured light, no textures: pure Cycles 5.3 dispersion.

@nodevember.bsky.social
#nodevember #nodevember2026 #GeometryNodes #b3d
```

## Alt text
- An orthographic Op Art poster on a black background: 28 tall, tightly spaced vertical triangular glass bars,
  twisted in a smooth wave. Across the upper half, white light refracts into a sweeping, silk-like band of blue, cyan,
  green, gold and crimson; across the darker lower half, dotted arcs of crisp white light climb diagonally through
  the twisted bars.

## Posting
- [ ] Mastodon (mention @Nodevember@graphics.social)
- [ ] Bluesky (@nodevember.bsky.social)
- [ ] X (@Nodevember)
- [ ] Instagram (@nodevemberio)
- [ ] Blender Artists (tag: nodevember)
- [ ] Posted
