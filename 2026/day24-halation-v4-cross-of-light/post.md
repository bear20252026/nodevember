# Nodevember 2026 · Day 24 · Halation — Cross of Light／光之十字

2026-11-26 · Blender 5.3 · Geometry Nodes and Cycles · 1080 × 1080 stills and a 10 s clip

**Reference:** the chapel is modelled after Tadao Ando's **Church of the Light** (Ibaraki, Osaka, 1989), a bare
concrete box whose end wall is cut through by a cross. The model follows photographs of the building; its dimensions
are approximate.

## Idea

Halation is what film does to the brightest thing in the frame. In a dark concrete chapel at dawn, the brightest thing
is a cross cut through the end wall. Before sunrise the cross is a thin blue line in the dark. The sun comes up behind
the wall, the cross burns white and grows a red ring, and a cross-shaped sheet of light crosses the dusty air onto the
floor and the benches.

**Constraint:** one Geometry Nodes tree builds the chapel. The red ring is the film base's own reflection, drawn from
its thickness and refractive index, not a glow filter. No image textures, no imported or modelled meshes.

## Build

1. **A box and four blocks.** Side walls, ceiling and back wall are four concrete boxes around a 17.4 × 5.9 × 5.9 m
   room. The end wall is four more blocks that do not touch: the gap between them is the cross, 0.2 m wide, floor to
   ceiling and wall to wall. Its width and the height of the bar are the tree's two sliders.
2. **Floor and benches.** A flat altar floor, then ten steps of 6 cm in black-stained cedar, one bench row per step.
   One bench is seven 4 cm planks; it is placed 20 times, each a few centimetres and about a degree off, as if set down
   by hand. A random tone per board is stored for the shader.
3. **Fair-faced concrete.** The shader rebuilds the formwork in metres on every wall: 1.82 × 0.91 m panels with their
   own tone, 2 mm seams, and six 31 mm tie holes per panel, each a few millimetres off its grid, plus soft mottle and
   pores.
4. **Air and dust.** A thin volume that thins toward the ceiling and swirls slowly scatters the sun forward, so the
   light sheets glow toward the camera. 40 000 dust motes drift and settle; the ones near the lens fade out.
5. **Dawn.** The sun rises from 2.6° below the horizon to 32° in 10 s, warming from deep orange to warm white, at
   10–13° off the nave axis, so the cross on the floor is skewed and the bar's sheet reaches the right wall. The sky
   seen through the slit is 30 times brighter than the sky that lights the room: the slit blows out on film while the
   chapel stays dark and lit mostly by the sun. Two portal lamps in the slit guide Cycles to the sky.
6. **The film.** A compositor group draws the halation kernel per pixel: light that crosses the emulsion reflects
   totally off the back of a 125 µm acetate base beyond the critical angle and lands back on the emulsion from about
   10 px out, in three passes, fading with absorption in the base. The frame is convolved with it in scene-linear light
   and 6 % is added back, red layer first. Only overexposed edges, like the slit, are bright enough to show it.

Exposed sliders on `PA_Chapel`: **Slit width** and **Bar height**.

## Animation

10 s at 24 fps. One slow shot from the benches: a 35 mm lens at f/5.6 drifts 40 cm down the aisle. The first second
is blue hour. The sun clears the horizon at about 1.2 s; by 2 s the bar's light sheet is coming down through the haze
and at 2.5–2.7 s it passes the camera's eye height. For the rest of the clip the sun climbs and the cross of light
slides across the floor and benches toward the wall.

## Files

- `cross-of-light.mp4`: the clip, 1080 × 1080, 24 fps, with film grain.
- `render.png`: frame 130, 1080 × 1080.
- `render-036.png`: frame 36, sunrise, 1080 × 1080.
- `nodes/`: the node trees:
  - `main.png` (the chapel);
  - `box.png`;
  - `halation.png` and `halation-pass.png` (the film);
  - `concrete.png`, `cedar.png`, `air.png`;
  - `sky.png` (the dawn sky).
- `tutorial/`: a node-by-node walkthrough.

Rendered in Cycles, 256 samples, on a Mac (Apple Metal) and a second PC with an RTX 4060 (OptiX).

## Caption

**Nodevember 2026 · Day 24 · Halation | Cross of Light**

Dawn in a concrete chapel, on film with the anti-halation backing gone. Before sunrise the cross is a thin blue line in
the dark; the sun comes up behind the wall, the cross burns white, and a sheet of light crosses the dusty air onto the
benches.

The red ring is not a glow filter. It is the film base: light that crosses the emulsion reflects off the back of the
base beyond the critical angle and lands ~10 px away (2·t·tan θc for 125 µm acetate), red layer first. One Geometry
Nodes tree builds the chapel. No image textures.

After Tadao Ando's Church of the Light (Ibaraki, 1989).

#nodevember #nodevember2026 #GeometryNodes #b3d

## Alt text

A dark, bare concrete chapel seen from the benches. The far wall is cut through by a cross-shaped slit that runs floor
to ceiling and wall to wall; it glows white with a red-orange halo along its edges. Warm sunlight from the slit falls as
a soft sheet through hazy air, draws a thin line down the right-hand wall and a bright stripe along the dark wooden
floor. Rows of dark plank benches fill the lower right.

## Posting

- [ ] Mastodon (mention @Nodevember@graphics.social)
- [ ] Bluesky (@nodevember.bsky.social)
- [ ] X (@Nodevember)
- [ ] Instagram (@nodevemberio)
- [ ] Blender Artists (tag: nodevember)
- [ ] Posted
