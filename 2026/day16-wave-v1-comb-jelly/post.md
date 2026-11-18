# Nodevember 2026 · Day 16 · Wave

Date: 2026-11-16

## Idea
- Reading of the prompt (literal / lateral / personal): lateral, from nature. Picked from a spread of eight ideas
  (a comb jelly's rainbow wave).
- One-sentence concept: a sea gooseberry (Pleurobrachia-like comb jelly, ~1.5 cm) hangs in black water, then starts
  to swim: its eight comb rows beat one paddle after another, so a metachronal wave runs down every row from the
  apical organ to the mouth, and the paddles scatter the light into rainbow bands that travel with it.
- Constraint I'm stating in the caption: one Geometry Nodes tree on an empty object (body, 192 comb plates, organs,
  two tentacles with ~300 tentillae, marine snow); no image textures, simulation or imported assets.
- Technique to learn or show off: metachronal wave as a per-plate phase lag (Beat − delay − j / wavelength),
  an asymmetric stroke (fast stiff power stroke, slow curling recovery), a stop front that also travels to the
  mouth; structural-colour shader (hue from each plate's place in its stroke and its angle to light and lens).
- Output: animation 12 s, 24 fps, 1080² (1:1), Cycles, dark-field black; white clay (Workbench) first for approval.

## Biology (checked 2026-11-16)
- Eight ciliated comb rows; Pleurobrachia ~1.5 cm, egg-shaped, mouth at the oral end, apical organ (statocyst) at the
  aboral end, which paces the rows ([faculty.washington.edu/cemills](https://faculty.washington.edu/cemills/Ctenophores.html),
  [animaldiversity.org](https://animaldiversity.org/accounts/Ctenophora)).
- The colours are light scattered by the moving cilia, not bioluminescence; Pleurobrachia does not produce light.
- Power stroke towards the aboral end, the wave travelling the opposite way (antiplectic); the animal swims mouth first.
- Beat frequency in the literature 4–17.5 Hz ([J Exp Biol 183:149](https://cob.silverchair.com/jeb/article-pdf/183/1/149/3383746/jexbio_183_1_149.pdf)):
  shown here at 1.5 Hz, about 10× slower than life, so the wave can be seen.
- Simplified / not modelled: ctene count per row (24 chosen, not from a source), the exact plate shape, real
  refraction (mesoglea is nearly index-matched to sea water, so the body is a see-through skin with grazing
  reflections plus faint scattering), balancer cilia (too small at this scale).

## Reference photos (checked 2026-11-16, Wikimedia Commons)
- Dark-field Pleurobrachia: [P. bachei](https://commons.wikimedia.org/wiki/File:Pleurobrachia_bachei.jpg) (CC BY 3.0),
  [P. pileus 428757741](https://commons.wikimedia.org/wiki/File:Pleurobrachia_pileus_428757741.jpg) and
  [430836156](https://commons.wikimedia.org/wiki/File:Pleurobrachia_pileus_430836156.jpg) (CC BY 4.0). Anatomy:
  [Invertebrate Anatomy OnLine, Pleurobrachia](https://lanwebs.lander.edu/faculty/rsfox/invertebrates/pleurobrachia.html).
- What the photos show and v1 lacked: the comb rows are milky white "ladders" (ciliated band + meridional canal,
  a cushion under each plate) visible even at rest; the rainbow is small saturated flecks on the plates, strongest
  near the rim; the pharynx and the two tentacle sheaths are long white spindles (milky walls, brightest edge-on);
  thin canals run from the stomach out to mid-row; gut contents show orange; the body itself is clear with a thin
  rim; the oral end is the more pointed one; tentacles are thin with tentillae along one side.

## Build log
- v1 previews: GN curves on a mesh object don't render in Cycles (they come through as legacy curves) → tubes via
  Curve to Mesh with Radius → Scale. A refractive body (IOR 1.06) blocked direct light to its inside volume and organs
  → noisy grey haze; a transparent skin + Fresnel glossy fixed it. Lights hidden from glossy rays so the skin's edge
  shows a soft dome, not two hot bands.
- v2 (after the colour preview, "refer to real scientific images, more detail"): compared against the dark-field
  photos above. Added the gut-canal system (8 meridional canals under the rows, stomach → transverse →
  interradial → adradial canals to mid-row, 2 paragastric canals, aboral canal splitting into 2 anal canals), a
  folded pharynx + stomach, tentacle sheaths running from openings in the aboral third up to the pharynx with a
  warm tentacle bulb inside, the tentacle starting at the bulb and leaving through the sheath, statolith as a
  cluster of granules, two polar fields, orange gut contents, skin specks, row bands with a cushion per plate.
  Plates shortened (0.48 mm), frayed tips (each cilium ends at its own length), white-translucent at rest.
  Tissue = Transparent ↔ (Translucent + a little Diffuse) weighted by base + edge·(1 − |N·I|)^p, so walls read
  brightest edge-on like the photos; no volumes (the grey haze is gone). Lights cut to ~¼ and cooled: the
  translucent tissue picks up the backlight strongly (the first try was blown out white).
- v3 ("more realistic, some sense of depth"): side by side with the photos, v2 read as a wire cage: an empty black
  inside, organs drawn as outlines, everything equally sharp, even light. Changes: the mesoglea gets a faint
  forward-scattering volume (density 3, bluish: fine particles scatter blue more), so the jelly fills with a glow
  that is thickest through the middle and dims what lies behind it; the pharynx, stomach, sheaths and bulbs are
  filled with denser scattering volumes, so they read as solid milky masses; macro depth of field (100 mm, f/16,
  focused 1.5 mm in front of the centre) leaves the near rows and the outline sharp and the far side soft; the key
  light from one side (0.34 / 0.11 / 0.07), cooler. Comb-row bands: a narrow core plus a soft halo, cushions
  toned down (v3's first try was zebra-striped). Sheath openings moved towards the aboral pole (θ 0.2π), so the
  sheaths run near the axis as in the photos. Fine canals and tentacles fainter and thinner; tentillae unevenly
  spaced, each with its own droop. Homogeneous volumes cost almost nothing in Cycles (still ~15 s per 1080 frame).
- v3 final (user: "not so blue, less focus blur"): jelly volume density 2, colour (0.55, 0.72, 1.0) instead of
  (0.22, 0.48, 1.0); lights back to v2's near-white cool; f/16 → f/24. Final: 1080², 128 spp, motion blur, the
  whole shot on one GPU on a second PC (one device, no Metal/OptiX hand-off).
- Grain (feedback: "too clean" → "too heavy: high-ISO noise, not a bad signal"): grain.py adds the noise the way a
  sensor does, in linear light: read noise + shot noise (σ² = read² + gain·signal), per pixel, softened like
  demosaicing, mostly luminance with a little fine colour noise, then back to sRGB, after a cos⁴ vignette. The
  tone curve keeps the bright tissue clean and puts fine grain in the shadows and the black water. Chosen: ISO 3200
  (read 0.0011, gain 0.00022). The first try (display-space noise, strongest in the highlights, coarse colour
  blotches) read as TV static.
- Fixes after the first final (user: "the filaments jump at about 1 s"; "the tentacle should come out along the
  sheath"): (1) the tentillae were sampled by current length (Curve to Points, Count) and cut near the sheath, so
  as the tentacle swayed one filament came and went (vertex count ±56 at frames 30 and 42) and every filament after
  it took its neighbour's random shape, which also switched motion blur off for those frames. Now each tentilla
  sits on a fixed tentacle point (Evaluated points, every 3rd, by index): the count is constant over all 288
  frames and their quarter-frame steps. (2) The tentacle left the opening sideways (a fixed arc out, then down);
  now it leaves along the sheath's own direction and turns smoothly to hang within ~3 mm
  (p = d1·s + (d0 − d1)·T_OUT·(1 − e^(−s/T_OUT))). Re-rendered on the second PC:
  a tile-diff scan of all 288 frames finds no spike (the old render spiked at frames 30 and 43), and the filaments
  keep their shapes from frame to frame.
- Tutorial (2026-11-17): the flat 648-node tree was split into a 26-node main tree (10 numbered sections, one group
  each) and 15 node groups with lettered sections and labelled crossing values (660 nodes in 16 trees). Proven
  unchanged: evaluated mesh, attributes and points at frames 1/30/82/160/250 are bit-identical to the old build,
  and the material/world graphs hash the same, so the earlier render stands.

## Files
- [x] loop.mp4 (12 s, 24 fps, 1080², Cycles 128 spp with motion blur, ISO 3200 grain; frame scan: no spike over
  1.8× the local median in 36×36 tiles, whole-frame diff max 1.0/255)
- [x] render.png (hero still: frame 120, mid-swim), render-200.png (frame 200, later in the swim as the rows go quiet)
- [x] nodes/main.png (the 26-node main tree), nodes/material.png (the structural-colour plate shader), nodes/wave.png
- [x] tutorial/README.md (node-by-node walkthrough, node shots, schedule / stroke / wave / exit plots, labelled
  anatomy, storyboard, 3× close-ups)
## Caption
Generated with `nodevember.py caption 16 --tools "Blender Geometry Nodes" --title "Sea gooseberry" --constraint
"one Geometry Nodes tree on an empty object, no image textures, simulation or imported assets" --note "…"`.
Audit: strict procedural, no issues; 660 nodes in 16 trees (PA_CombJelly_GN: 26 nodes + 15 groups).

Mastodon / Instagram / Blender Artists:

    Nodevember 2026 · Day 16: Wave | Sea gooseberry

    Eight comb rows beat one paddle after another: a metachronal wave runs down each row, and the moving cilia scatter light into rainbows. Slowed ~10x.

    Rules: one Geometry Nodes tree on an empty object, no image textures, simulation or imported assets

    Made with Blender Geometry Nodes.

    @Nodevember@graphics.social   (Instagram: @nodevemberio)

    #nodevember #nodevember2026 #GeometryNodes #b3d

Bluesky / X (the note does not fit): the same without the middle paragraph, @nodevember.bsky.social / @Nodevember.

Blender Artists breakdown bullets:
- Metachronal wave = a per-plate phase lag: local beat = Beat − row delay − plate / wavelength; a stop front
  travels the same way, so the rows go quiet from the apical organ to the mouth.
- Asymmetric stroke: a fast stiff power stroke and a slow curling recovery, from one small node group.
- Structural colour: hue from the plate's place in its stroke and its angle to light and lens (Wavelength node),
  frayed cilia tips; resting plates still glint at the right angle.
- Depth: the jelly and organs are homogeneous scattering volumes (nearly free in Cycles), plus a macro depth of field.

## Alt text
- A clear, egg-shaped sea gooseberry hangs in black water. Eight milky comb rows curve round its faintly glowing
  body; inside are a white pharynx, two tentacle sheaths and a speck of orange food, and two thin tentacles fringed
  with fine filaments trail below. As it starts to swim upward, tiny flecks of red, green and blue light ripple
  along every row from the bottom to the top, then fade as it slows and stops.

## Posting
- [ ] Mastodon (mention @Nodevember@graphics.social)
- [ ] Bluesky (@nodevember.bsky.social)
- [ ] X (@Nodevember)
- [ ] Instagram (@nodevemberio)
- [ ] Blender Artists (tag: nodevember)
- [ ] Posted
