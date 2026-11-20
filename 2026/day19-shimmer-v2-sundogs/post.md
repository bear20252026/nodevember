# Nodevember 2026 · Day 19 · Shimmer

Date: 2026-11-19 (made on 2026-11-18 as a take on Day 18 · Prism, then moved to Day 19 with the model and the
animation unchanged)

## Idea
- Reading of the prompt: lateral, from nature. Shimmer is diamond dust: the still air at sunrise glitters with
  drifting ice crystals. A crystal flashes only at the moment its facets send the sun to your eye, and the angles that
  do this are the halo angles, so the flashes crowd onto the sun dogs, the pillar and the arcs. A halo is shimmer,
  added up. (It began as a Prism idea: every hexagonal ice plate is a 60° prism, and a sky full of them turns the sun
  into three suns.)
- One-sentence concept: **Diamond dust.** Diamond dust at sunrise over a frozen lake. The sun lifts off the far shore,
  the still air fills with drifting ice crystals and the sky builds the display real diamond-dust mornings show: a sun
  pillar first, then two sun dogs 22° either side of the sun (red inner edge, white tail), the upper tangent arc and
  the 22° halo, with single crystals glittering near the lens.
- Constraint: every halo is ray-traced in Geometry Nodes through hexagonal ice crystals (Snell, unpolarised Fresnel,
  total internal reflection; one wavelength per ray, 400–700 nm, ice's measured index), binned on the sky and drawn as
  light; the glitter near the lens samples the same traced map. Cycles renders the scene. No image textures,
  simulation or imported assets.
- Technique: a Monte Carlo halo tracer in GN (one Raycast per face in a repeat zone, a multi-item Capture Attribute so
  the hit is evaluated once), stratified wavelength bands with CIE colours, a folded sky map (Accumulate Field by
  cell), a dome of vertices at the cell centres; glitter placed in the camera's view, with aperture-sized hexagonal
  bokeh.
- Output: animation 12 s (288 frames, 24 fps), 1:1 1080², Cycles. Locked-off tripod on the ice, 24 mm, looking at the
  sunrise.

## Physics (checked 2026-11-18)
- Ice index: Warren & Brandt 2008 (ordinary ray), 400 nm 1.3194 … 700 nm 1.3069, Cauchy fit (3 terms) within 0.0004.
- A numpy reference tracer (2 M rays a population), written before the node build:
  random crystals, minimum deviation per wavelength vs 2·asin(n/2) − 60°: 700 nm 21.60° (theory 21.62°),
  550 nm 21.90° (21.91°), 400 nm 22.45° (22.52°); the inside of the halo is dark (0.6 % of rays at 18–21°).
  Plates at sun elevation h: sun-dog azimuth vs Bravais n′ = √(n² − sin²h)/cos h: 21.60° traced vs 21.72° (red, the
  half-max inner edge sits slightly inside because of the sun's disc and the tilt). Over this sunrise (h −0.3° → 5.5°)
  the sun dogs move out by only ~0.2°, so the motion is the display switching on, not the dogs moving.
  Columns: the tangent arc sits 22.6° above the sun. Plates give the subsun below the horizon; the upper pillar needs
  plates tilted more than the sun's elevation, so it shows while the sun is low (a second, more wobbly plate
  population).
- The Geometry Nodes map matches the numpy map feature for feature (sun dogs, parhelic circle, tangent arc, 22° halo,
  pillar, subsun and subparhelia below the horizon).
- Sun: the sky model's own sun-disc irradiance by elevation, measured by rendering the disc (aerosol 0.4 for clean
  arctic air); the sun lamp and the halo light both use it, so the halos carry the low sun's colour.
- Brightness: radiance = τ · (share of scattered light per solid angle) · E_sun. The optical depths are set by eye
  against the sky (sun dogs ≈ 10–15× the sky, tangent arc ≈ 3×, 22° halo ≈ the sky), not measured. Found while
  writing the tutorial: the map's weight lacks the factor 24 of the wavelength bands (the 24 band colours sum to white),
  so the τ sliders read as 24 × the optical depth (plates 0.085 ≈ 0.0035, random 0.45 ≈ 0.019). The look is
  unaffected.
- Glitter: a halo is bright where more crystals flash toward you, so each near crystal's chance to flash follows the
  traced radiance in its direction; a flash has that direction's colour and a fixed strength.
- Simplified: diffraction (no corona or aureole from the crystals), multiple scattering, polarisation; the dust layer is
  drawn as a dome 200 m away (in front of the trees: the dust is local), so the halos also cover the trees, as in
  real diamond dust.

## Build log
- Trace bug avoided: GN fields are evaluated again on every node's geometry, so Set Position before Store would
  re-run the Raycast from the new point. A multi-item Capture Attribute takes hit, position, direction and inside once.
- The first full scene was white: the Multiple Scattering sky is in physical units (sun at 3.5° ≈ 30, sky ≈ 1–3). The
  sun lamp now follows the sky's own sun, exposure −3.
- Glitter v1 (brightness ∝ map) filled the sky with speckle; v2 (chance ∝ map, fixed strength) puts the sparkles on
  the arcs and the pillar.
- Self-check round 1 (full-res frame 200 against diamond-dust photos and the numeric checks above): sun dogs at the
  frame edge → 24 mm lens; the treeline too thin → closer headlands; the 22° halo's outer glow read as a cut-out →
  τ random 1.1 → 0.45; snow read as water waves → terraced sastrugi, rougher snow, sparkle facets; orange forest →
  darker base, cooler haze; sun dogs a touch dim → τ plates 0.085.
- Self-check round 2 (all 288 frames at 50 %, 16 spp, frame-difference scan): no jumps; frame-to-frame change median
  0.37/255 sky, 0.70 ground (the sun rising). Every ray keeps its index-tied random numbers, so only the sun elevation
  and the optical depths change between frames; 100 % strips of 8 consecutive frames show the tangent arc and sun
  dogs steady (no boiling).
- First final render: the worst flicker (per-tile second difference |f(t) − (f(t−1) + f(t+1))/2| on 60 px tiles,
  which ignores the steady sunrise) was 9.0 levels at frame 229: near crystals 0.5–1 m from the lens flashed for only
  2 frames and switched colour between them, because they cross many 0.2° map cells per frame and the flash chance
  and colour were looked up anew each frame. Glints v3: a soft bump (1 − x²)² of 0.14 cycle, and whether and in what
  colour a crystal flashes is decided once, at its direction at the peak of the flash. Rates 0.25–0.6 Hz (6–13 frame
  flashes), density 0.22.
- Final (the piece): 1080², Cycles 128 spp + OpenImageDenoise, persistent data. Frames 1–199 with Apple Metal at
  15.0 s a frame (about 1 s of it the tracer), 200–288 on a second PC with an RTX 4060 (OptiX), 50 min in all. Ten
  overlap frames rendered on both: PSNR 67.1–68.4 dB, brightness difference ≤ 0.001/255, so no crossfade. Tile
  second difference median 1.03 (was 1.65), worst 3.5 (was 9.0); the worst spots are now crystals fading in over 5–8
  frames as they drift. Glint counts within 2–4 % of the first render.
- 100 % crops: a sun glitter path on the snow, the red inner edge of the sun dog and the tangent arc, crystals
  sparkling most on the arcs; out-of-focus crystals near the lens show as soft hexagonal discs.
- For the tutorial the trees were restructured for readability: lettered sections in every group, repeated formulas
  gathered into four small helper groups (Sky Cell, Unit Vector, Fresnel, View Direction). The evaluated scene (every
  vertex, attribute and instance at frames 1, 150 and 240) is identical before and after. 447 nodes in the sky tree
  with 10 groups, 155 in the lake tree. Audit: strictly procedural, no issues.
- Checks at frame 240 (sun 4.17°): 22° halo inner edge (half max) red 21.75°, blue 22.25°, 6 % inside; sun dogs red
  21.9°, blue 22.5° (Bravais 21.80°, 22.39°); tangent arc 22.13° above the sun. With the sun at 10°, 20° and 30° the
  plates' sun dogs sit at 22.5°, 24.7° and 28.7° (Bravais 22.55°, 24.65°, 28.80°).

## Exposed parameters
- Keyed: `Sun Elevation` −0.3° → 5.5° · `Plates` 0 → 0.085 · `Wobbly Plates` 0 → 0.5 → 0.12 · `Columns` 0 → 0.18 ·
  `Random` 0 → 0.45 · `Dust` 0 → 1
- Fixed: `Plate Tilt` 0.6 · `Wobble Tilt` 3 · `Column Tilt` 0.5 · `Rays` 2.5 · `Bounces` 8 · `Blur` 2 ·
  `Glint Gain` 0.002 · `Glint Density` 0.22 · `Seed` 3

## Learning
- Glints as importance-sampled flashes (chance ∝ the traced radiance, fixed strength, colour from the map) read as
  real sparkle; brightness ∝ map reads as noise. Reusable for any shimmer: frost, sequins, fish scales, heat haze.
- Check physical units first: the Multiple Scattering sky and a calibrated sun need exposure ≈ −3 under AgX.
- A twinkle must still fade: give each flash ≥ 6 frames and fix its on/off and colour at the flash peak; check
  with a per-tile second difference and 100 % strips of consecutive frames, not the frame mean.

## Files
- [x] loop.mp4 (288 frames, 12 s, 24 fps, 1080², H.264 CRF 16)
- [x] render.png (frame 240, the hero still), render-090.png (frame 90)
- [x] nodes/: main.png (1 Ice crystals → 2 Sun rays → 3 Trace through the ice → 4 Halo map → 5 Sky dome → 6 Glitter
  near the lens), sun-rays, trace, halo-map, sky-dome, glints, lake
- [x] tutorial/README.md (node-by-node walkthrough: node shots, the prism and its deviation curve, traced sky maps per
  crystal population, glint stacks, Try-it results)

## Caption
Mastodon:
```
Nodevember 2026 · Day 19: Shimmer | Diamond dust

Sunrise on a frozen lake; the air shimmers. A crystal flashes only when its facets send the sun to your eye, so flashes crowd onto the sun dogs, the pillar and the 22° halo: a halo is shimmer, added up.

Each halo is ray-traced in Geometry Nodes through hexagonal ice, one wavelength per ray; glints follow the same map. No image textures.

Blender Geometry Nodes + Cycles
@Nodevember@graphics.social
#nodevember #nodevember2026 #GeometryNodes #b3d
```
Bluesky / X:
```
Nodevember 2026 · Day 19: Shimmer | Diamond dust
A crystal glints only when its facets send the sun to your eye, so the shimmer crowds onto the sun dogs, the pillar and the 22° halo. 9 M rays a frame, traced in Geometry Nodes.
@nodevember.bsky.social
#nodevember #nodevember2026 #GeometryNodes #b3d
```
Instagram / Blender Artists: the Mastodon text plus
```
Breakdown:
· The glitter: each crystal near the lens gets a chance to flash that follows the traced halo in its direction, so crystals flash more often where the halo is brighter. A flash has that direction's colour, a fixed strength and a soft 6–13 frame fade.
· 9 M sun rays a frame, each with its own wavelength (ice index from Warren & Brandt 2008), hit one hexagonal crystal in its own orientation: plates lying flat, columns lying flat, random crystals.
· One Raycast per face in a repeat zone: Snell, unpolarised Fresnel (reflect or refract by chance), total internal reflection.
· Exit directions binned on the sky in 0.2° cells and drawn on a dome as light, in the low sun's colour.
```

## Alt text
- A frozen, snow-covered lake at sunrise. The low sun sits over a distant shore between two dark spruce headlands, and
  a thin pillar of light rises from it. Two bright sun dogs glow at the edges of the trees on either side, a faint
  circular halo arcs over the sun with a bright V-shaped arc at its top, and the air glitters with tiny ice crystals.
  As the sun climbs, the pillar appears first, then the sun dogs and arcs brighten while crystals near the camera
  fade in and out in softly coloured flashes, most often along the arcs.

## Posting
- [ ] Mastodon (mention @Nodevember@graphics.social)
- [ ] Bluesky (@nodevember.bsky.social)
- [ ] X (@Nodevember)
- [ ] Instagram (@nodevemberio)
- [ ] Blender Artists (tag: nodevember)
- [ ] Posted
