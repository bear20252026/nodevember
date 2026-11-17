# Nodevember 2026 · Day 15 · Pearl

Date: 2026-11-15

## Idea
- Reading of the prompt (literal / lateral / personal): literal, at every scale: where a pearl's lustre comes from.
- One-sentence concept: one camera move from a whole 8 mm pearl down to its growing surface (aragonite tablets ≈ 8 µm × 0.45 µm in terraces), then back out.
- Constraint I'm stating in the caption: one Geometry Nodes tree, no image textures; the growth lines seen through a loupe and the tablet terraces come from the same growth-height field.
- Technique to learn or show off: thin film per nacre layer (white noise of the layer index, identical in GN and the shader), a tablet patch that takes over from the shader below 1.2 mm frame width, scale-invariant camera (log zoom, lens shift, depth of field ∝ distance).
- Output: animation 18 s, 24 fps, 1:1, Cycles; white clay first for approval.

## Build log
- Physics: the layers are concentric with the pearl; the surface sits a few µm off them (growth height h). Where h crosses a whole number of layer thicknesses a layer ends: a terrace edge (the "fingerprint" lines of a real pearl).
- Tablet patch: a jittered 60° lattice → Dual Mesh (one polygon per tablet), duplicated M+1 times per cell, each layer shifted by its own random offset (brick-wall stacking), kept where 0 ≤ h/t − k < M; tablets at a layer's front are young (small islands).
- Fixes on the way: Blender's default cube is 2 mm at mm scale (it poked out under the pearl); mature tablets were randomly shrunk (honeycomb look); a 0.3-wide growth front made every terrace look like fish scales.
- Shader → tablets hand-off (W = 1.2 mm): the shader's terrace bump puts the growth lines into the highlight, the real vertical steps don't — the highlight snapped to a clean diamond in one frame. Fix: the tablets carry the same bump when they switch on and it fades out by W = 0.45 mm (keyed value `PA_TabletBump`).
- Tahitian look: a dark body hides nothing, so ±60 nm per layer read as a contour map at loupe scale and as oil-slick blotches whole. Narrow film range (505–535 nm) plus a keyed `Terrace Colour` slider (GN tablets and shader read the same value) at 35 % at loupe distance, rising to 100 % before the tablets appear.
- Tablets looked like flat CG tiles. Now: more lattice jitter (irregular 5–12 µm polygons); within 0.45 mm of the dive point each outline is a blend of the polygon and its Catmull-Clark outline (linear and smooth subdivision share vertex order → Sample Index + Mix: 30 % for mature tablets, 100 % for young ones, which are round); thickness ±10 % per tablet; in the shader a random tilt per tablet (a brightness mosaic), 20 nm convex tops, 3 nm nanograins, film thinning towards the rim and a satin rim — all faded in with the zoom (1 − `PA_TabletBump`). Full Catmull-Clark first: a smoothed hexagon is a circle, so the tablets became pebbles with wide gaps.
- Full-res checks rendered on a second PC with an RTX 4060, ~40 s per 3 frames at 1080² / 128 spp.

## Files
- [x] loop.mp4 (1080², 24 fps, 18 s, 432 frames; Tahitian look, light backdrop, 128 spp)
- [x] render.png (hero still: frame 200, the tablets under the sweeping light) · render-060.png (frame 60, the whole pearl)
- [x] nodes/main.png (PA_Pearl_GN: nine section frames, one Group Input each; 155 nodes, 4 helper groups) · nodes/material.png (68 nodes in five frames) · nodes/growth.png, film.png, patch.png, radius.png (the helper groups)
- [x] tutorial/README.md (node-by-node walkthrough: 10 sections, cut-outs, terrace cross-section, zoom curve, top-down layer maps)

Final render: frames 1–280 on an Apple Silicon Mac (Metal), 281–432 on a second PC with an RTX 4060 (OptiX), 128 spp + denoise; the switch frames matched the approved tests (mean luma within 0.5/255).

## Learning for tomorrow
- A zoom that crosses a representation switch (shader detail → real geometry) pops wherever the two disagree about the highlight. Carry the old detail into the new representation for a few frames and fade it out, instead of matching colours alone.
- Close-ups of cells/tablets read as CG tiles until each element varies in tilt, height and colour and the corners are only slightly rounded.

Audit: strict procedural, no issues (pb.audit).
Tutorial tidy (2026-11-17): sections split to ≤ 30 nodes, PA_LayerFilm as a group shared by GN and the shader; the rebuilt scene evaluates to bit-identical geometry and attributes at frames 1/150/250/340 (renders differ by 0.008/255 mean, Metal noise level).

## Caption
**Mastodon / Instagram / Blender Artists**

Nodevember 2026 · Day 15: Pearl | Nacre Dive

An 18 s dive from a whole Tahitian pearl to its growing surface: 8 µm aragonite tablets, 0.45 µm thick, every layer its own thin film. The lustre is the light sliding over the terraces.

Rules: one Geometry Nodes tree, no image textures: the loupe-scale growth lines and the tablet terraces come from the same growth-height field

Made with Blender Geometry Nodes, Cycles.

@Nodevember@graphics.social  (Instagram: @nodevemberio)

#nodevember #nodevember2026 #GeometryNodes #b3d

**Bluesky (≤ 300) / X (≤ 280)**

Nodevember 2026 · Day 15: Pearl | Nacre Dive
From a whole pearl down to its 8 µm nacre tablets, every layer its own thin film. One Geometry Nodes tree, no textures.
@nodevember.bsky.social (X: @Nodevember)
#nodevember #nodevember2026 #GeometryNodes #b3d

**Blender Artists breakdown**
- One growth-height field h (two noise octaves, a few µm): where h crosses a whole layer thickness a layer ends — the same field draws the growth lines on the whole pearl (shader bump) and places the tablets in the close-up (geometry).
- Tablets: a jittered 60° lattice → Dual Mesh, duplicated per layer with a random shift (brick-wall stacking); young tablets at each layer's front are small and round.
- Thin film per layer, identical in GN and the shader, so the hand-off from shader to tablet geometry at 1.2 mm frame width doesn't pop.
- Scale-invariant camera: log zoom, lens shift, depth of field proportional to distance; the key light sweeps through the mirror direction while the camera orbits the tablets.

## Alt text
A dark Tahitian pearl with a green and rose sheen sits on a white background. The camera dives into its highlight: fine wavy growth lines appear, then stepped terraces, then individual irregular polygonal tablets, each catching the light a little differently in green and pink. The light sweeps across the tablets, and the camera pulls back to the whole pearl with the lustre in a new place.

## Posting
- [ ] Mastodon (mention @Nodevember@graphics.social)
- [ ] Bluesky (@nodevember.bsky.social)
- [ ] X (@Nodevember)
- [ ] Instagram (@nodevemberio)
- [ ] Blender Artists (tag: nodevember)
- [ ] Posted
