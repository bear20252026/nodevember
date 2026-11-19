# Nodevember 2026 · Day 17 · Caustics

Date: 2026-11-19 (late entry for 11-17)

## Idea
- Reading of the prompt: literal, as a generator. Picked from a spread of eight ideas: one node group cuts the classic
  patterns of pressed and cut glass into one decanter, and the caustic it throws changes with the pattern.
- One-sentence concept: a dark room, a snoot of low sun on a cut-crystal decanter, seen straight down; the table shows
  only the light that went through the glass. The cut morphs flutes → swirl → diamond thumbprint → honeycomb →
  hobnail (round domes = lenses, the climax), and the light on the table re-weaves itself from one lace into the next
  while the decanter turns 30°.
- Constraint: the caustic is ray-traced in Geometry Nodes and spectral: each sun ray is traced at K = 5 wavelengths
  (same position, so white stays white where nothing disperses), IOR from Cauchy fitted to n_d and the Abbe number,
  the same formula the Blender 5.3 Principled BSDF uses for the glass the camera sees (its new dispersion splits the
  glass rims into colour). One GN tree on an empty object, no image textures, no simulation, no imported assets.
- Technique: pattern height fields in (arc length, height) on a lathe grid (hex lattice by two offset rectangular
  grids, nearest centre wins); one closed profile (outside up, lip, inside down) so every face is air | glass and no
  booleans are needed; a Raycast tracer in a Repeat Zone (Snell, total internal reflection, Fresnel) + photon binning.
- Output: animation 14 s (336 frames), 24 fps, 1:1 1080², orthographic top view, Cycles in Blender 5.3.
- History: first planned on a warm-white sunlit table at 50°; the black top-down look came from the sheet of caustic
  maps made while designing the cuts.

## Build log
- Blender 5.3's Principled BSDF has spectral dispersion (`Transmission Dispersion Scale`, `… Abbe Number`). Its Cycles
  code uses Cauchy A + B/λ² from n_d and V_d (OpenPBR eq. 55–56), so the GN tracer uses the same formula.
- Prototype (a straight tumbler with a diamond cut): tracing in Geometry Nodes is cheap: 2.6 M rays × 10 bounces
  ≈ 1 s; K = 5 wavelengths ≈ 2.8 s. Full decanter (1.85 M verts, 12 bounces) ≈ 3.5 s a frame.
- Normals from the height function (finite differences, stored as `nrm` and set as custom normals): the caustic map
  at 768 and 1536 segments is the same (5 % difference after a 4×4 blur, photon noise only), so no mesh grid shows.
- Check: Dispersion 0 with K = 5 gives the K = 1 map (max |Δ| 0.0014, sums equal): the K copies sum exactly to white.
- Cut depth: 2.5 mm (34° facets) throws the light out of the shadow as haze; 0.6–1.2 mm facets image as rows of
  bright drops. Depth 1.2 mm (hobnail ×1.33).
- Pattern family (designed first in numpy): groove sets (flutes, swirl, diamond) and a centred rectangular cell
  lattice (aspect 1 → √3: rhombi → hexagons). Both give the same surface at the diamond thumbprint (max |Δh| 1e-17 m),
  so the morph switches family there; in Geometry Nodes the switch moves no vertex more than 0.0006 mm.
  Profile σ: concave dishes → flat facets → round domes; only honeycomb → hobnail passes a near-flat state.
- Five caustic maps (no Cycles): flutes = a fan of bands, swirl = the fan twisted, diamond thumbprint = a lace of
  rhombic patches, honeycomb = hex patches and bright seams, hobnail = rows of focused drops (each dome a lens).
- Night stage: a dark room with a snoot of sun on the decanter; the table is emission only (the photon map × albedo / π),
  the room light is seen only in the glass (Light Path: glossy or transmission, not camera), no direct sun on the table.
- Orthographic top view, decanter at the left, light fanning out to the right. The rainbow lines on the table come from
  the GN tracer's 5 wavelengths; the table is emission only, so the 5.3 Principled dispersion cannot reach it.
- Timeline: 336 frames (14 s): hold flutes 1.5 s, morphs 1.5–1.75 s with 1 s holds, the honeycomb → hobnail
  inversion 2.25 s, hobnail hold 2.25 s; the decanter turns 30° linearly over the shot.
- Draft (270 px, 16 spp, K 3, 0.1 mm rays): no frame-to-frame spike. At 1080² the photon grain moved between frames;
  rays every 0.056 mm instead of 0.08 make it finer, so it reads as film grain.
- Tutorial refactor: the loose 60–130-node sections became helper groups (State Value, Pattern Keys, Groove Set,
  Round Edge, Smooth Min, Lobe, Cell ID): 777 nodes in 9 trees → 606 in 16, with positions, normals and caustic
  bit-identical before and after.
- Bug found while writing the tutorial: Transform Geometry turns positions and custom normals but not a stored vector,
  so the `nrm` the tracer reads lagged the glass by the whole turn (0° at frame 1 → 30° at frame 336). The glass the
  camera sees was right (custom normals); the light on the table was not. The check needs no eye: the hobnail has 12
  cells round, so its map at Turn 30° must equal Turn 0°. Before the fix they were 9.1/255 apart, after it 0.6/255
  (photon noise). Fix: Rotate Vector on `nrm` with the same rotation (+3 nodes), and the whole video was rendered again.
- Try-it checks for the tutorial: Bounces 3 drops the hobnail map's mean from 16.5 to 0.8 (crossing needs 4
  surfaces); Edge Round 0 made the cut vanish (Smooth Min divides by the crease width), so the slider now stops at 0.01.
- Final (Cycles, Metal, 1080², 128 spp, rays 0.056 mm, K 5): 336 frames in 1 h 16 min (about 13.5 s a frame).
  Frame scan: no frame over 2.5× its local median. The 5.3 Principled dispersion changes only the decanter itself
  (about 10 k pixels at frame 300): rainbow fringes on the lip and wall rings.

## Files
- [x] loop.mp4 (336 frames, 14 s, 24 fps, 1080², H.264 CRF 16)
- [x] render.png (hero still: frame 300, hobnail), render-150.png (frame 150, diamond thumbprint)
- [x] nodes/: main.png (1 Decanter → 2 Sun rays → 3 Trace → 4 Caustic map → 5 Table), decanter, cut-pattern,
  pattern-keys, sun-rays, trace, caustic-map, wavelength-rgb
- [x] tutorial/README.md (node-by-node walkthrough, node shots, pattern / profile / map figures, storyboard, close-ups)
## Caption
```
──── mastodon 412/500 chars
Nodevember 2026 · Day 17: Caustics | Five cuts of light

One crystal decanter, five classic cuts morphing in one node group. The table shows only light that passed through the glass.

Rules: caustic ray-traced in Geometry Nodes at 5 wavelengths; one node tree, no textures, no simulation

Made with Blender 5.3 Geometry Nodes, Cycles.

@Nodevember@graphics.social

#nodevember #nodevember2026 #GeometryNodes #b3d

──── bluesky 281/300 chars
Nodevember 2026 · Day 17: Caustics | Five cuts of light

Rules: caustic ray-traced in Geometry Nodes at 5 wavelengths; one node tree, no textures, no simulation

Made with Blender 5.3 Geometry Nodes, Cycles.

@nodevember.bsky.social

#nodevember #nodevember2026 #GeometryNodes #b3d

──── x 269/280 chars
Nodevember 2026 · Day 17: Caustics | Five cuts of light

Rules: caustic ray-traced in Geometry Nodes at 5 wavelengths; one node tree, no textures, no simulation

Made with Blender 5.3 Geometry Nodes, Cycles.

@Nodevember

#nodevember #nodevember2026 #GeometryNodes #b3d

──── instagram 398/2200 chars
Nodevember 2026 · Day 17: Caustics | Five cuts of light

One crystal decanter, five classic cuts morphing in one node group. The table shows only light that passed through the glass.

Rules: caustic ray-traced in Geometry Nodes at 5 wavelengths; one node tree, no textures, no simulation

Made with Blender 5.3 Geometry Nodes, Cycles.

@nodevemberio

#nodevember #nodevember2026 #GeometryNodes #b3d

──── ba 
TITLE: Nodevember 2026 · Day 17 · Caustics | Five cuts of light
TAGS: nodevember, geometry-nodes, procedural

One crystal decanter, five classic cuts morphing in one node group. The table shows only light that passed through the glass.

Rules: caustic ray-traced in Geometry Nodes at 5 wavelengths; one node tree, no textures, no simulation

Made with Blender 5.3 Geometry Nodes, Cycles.

(render / loop here)

Node tree:

(nodes.png here)

Breakdown: (2–4 bullets on the key trick)
```

## Alt text
- Video, top-down, black background: a cut-crystal decanter seen from above as glass rings at the left; to its right
  the light that passed through it spreads across a dark table in warm ivory. As the cut on the decanter changes, the
  light changes with it: a fan of straight bands (flutes), the fan twisting (swirl), a lace of diamond patches
  (thumbprint), hexagonal patches (honeycomb), and finally scattered bright teardrop-shaped spots focused by round
  domes (hobnail). Thin rainbow fringes line some of the light's edges.

## Posting
- [ ] Mastodon (mention @Nodevember@graphics.social)
- [ ] Bluesky (@nodevember.bsky.social)
- [ ] X (@Nodevember)
- [ ] Instagram (@nodevemberio)
- [ ] Blender Artists (tag: nodevember)
- [ ] Posted
