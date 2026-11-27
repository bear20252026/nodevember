# Nodevember 2026 · Day 22 · Lens — Sunlit Facets／逆光複眼

2026-11-24 (late entry) · Blender 5.3 · Geometry Nodes and Cycles · 1080 × 1080 still, 8 s animation and a 7 s human-eye → compound-eye clip

## Idea

A second look at v2 (Compound Bloom), pushed for light and mood. A camera sits at the centre of a hemispherical compound eye
of 415 solid glass facets and looks out at one coral poppy, backlit by a low golden sun. A gust swings the poppy off the sun,
and the sun lights up across the eye facet by facet. Each facet sits in a slightly different place, so each one sees the
petal edge clear the sun at a slightly different moment.

**Constraint:** one poppy and one sun. There is no hex overlay and there are no duplicated flowers or sun sprites. Every
repeated poppy and every sun star in the frame is Cycles refracting the same scene through real closed glass lenses. No image
textures or imported meshes. The only post-processing is a Bloom and a 4-point Streaks glare, and only the sun images are
bright enough to trigger them.

## Build

1. **Facet centres on a sunflower spiral.** Golden-angle points on the dome, spaced in an equal-area coordinate
   `t(u) = u + (Fovea − 1) · w · (1 − e^(−u/w))`. Central facets are 3.2× the area of the rim ones, like an insect's
   acute zone.
2. **Spherical Voronoi from two nodes.** Convex Hull of the points (plus a back pole that closes the hull), then Dual Mesh,
   projected back onto the sphere. The default eye has 325 hexagons, 53 pentagons and 37 heptagons. The defects follow
   the spiral's parastichy changes, as they do in real eyes.
3. **A closed lens per facet.** Split Edges, shrink each cell, subdivide, lift it back onto the sphere, flip, extrude
   inward and weld the original copy back on: one watertight solid per facet. A check mode confirms 415 islands,
   0 non-manifold edges and 0 negative volumes.
4. **Grind the corneas.** Spherical sag from each facet centre, `√(Rc² − d²) − √(Rc² − (1.12 r)²)`, with Rc proportional
   to the facet radius, so a bigger central facet also gives a bigger image. The arc distance uses the chord form
   `2 asin(|a − b| / 2)`; `acos` of a dot product near 1 left star-shaped float32 artefacts in every lens.
5. **Glass and cuticle.** Principled BSDF transmission, IOR 1.48, with 5.3 dispersion at Abbe number 26, so each sun
   image has a thin rainbow rim. Thin amber-chitin ridges (translucent) run along the Voronoi edges, with small knots at
   the junctions.
6. **Light.** Procedural evening sky with a 2° sun disc. Only camera and transmission rays see the disc, which is what
   lights the facets. A Sun lamp in the same direction lights the meadow, so nothing is counted twice. Forward-scattering
   haze sits behind the flower. Cycles counts the sky seen through glass as *indirect* light, so the default indirect
   clamp of 10 had turned each sun image into a grey dot. The clamp is off and refractive caustics are disabled.
7. **Petals as crumpled silk.** The regular sine frill and parallel pleats from v2 were replaced by noise. Broad waves sit at
   the rim, ridged creases are stretched along the radius (they fade out before the margin, so the edge stays a soft wave
   instead of a sawtooth), and a fine crinkle sits on top. A crepe-paper bump in the material adds detail. Leaves keep
   the old frill (`Crumple` 0).

Exposed sliders: `PA_Compound eye` **Facet Count**, **Fovea**, **Fovea Width**, **Cornea Radius**, **Dome Radius**,
**Vision**, **Wave Width**, **Hide Clear Facets**;
`PA_Poppy` **Lean**, **Nod**, **Flutter**; `PA_Meadow` **Wind**; `PA_Ruffled petal` **Crumple**.

## Animation: the sun comes out

8 s at 24 fps, 1080 × 1080. The poppy rests leaning 16° right with the sun behind its petals. From 1.25 s a gust swings it
to −4.5°, back to +2.2° and down to 0°, where the last frame is the hero still. A small script casts a ray from every
facet that has the sun in its field: at 14° lean none see it, at 4° almost all do. So the sun lights up across the eye
between about 1.6 s and 3 s. Petal flutter and meadow wind rise with the gust. Airborne pollen drifts left, and the eye
hovers by less than a degree.

The motion was approved as a white-clay pass first. Workbench cannot draw a fisheye, and from inside the
dome everything is glass, so the clay uses a wide perspective camera riding on the eye, with the dome hidden and a yellow
ball marking the sun.

## Second clip: from a human eye to a compound eye

7 s at 24 fps, 1080 × 1080 (`vision-transition.mp4`). The plant holds the hero pose. The clip opens on what a human would
see from the same spot: one backlit poppy and one sun. Every facet is still there, but its IOR is 1.0, so it bends nothing
and is invisible. The view widens (fisheye 30 → 21 mm), then a wave runs from the rim to the centre (the `Vision` slider;
each facet stores a `cornea` attribute that the glass reads). In each facet the clear view dissolves into the lens view,
and the lens settles from IOR 1.30 to 1.48 as it fades in. The amber seams grow in with the same wave. When the centre
has turned, the poppy repeats across the eye and the single sun has melted into a cluster of small suns.

The first try ramped the IOR straight from 1.0 to 1.48. Between IOR 1.07 (small rim facets) and 1.14 (the largest)
each facet's focal point passes through the camera: the facet's image blows up and flips, and next to the sun it flashed white for a frame and then came back.
The dissolve starts the lens past that crossing, so no facet goes through it. The human view also showed the top edge
of the haze box as a hard arc in the sky, so in this clip the haze thins out with height.

After the optics, an illustrative bee-inspired false colour fades in, using the same recipe as v2: the petal ramps blend
to a blue-violet palette (darker throat, bright tips), the pollen turns yellow-green, and a gentle cool grade sits under
the bloom and streaks. It is an RGB proxy, not measured UV reflectance.

The timing was checked as a white-clay pass first. Facets that are still clear are hidden there
(`Hide Clear Facets`), and the switched ones draw as white tiles, so the wave reads from the rim inward.

## Files

- `render.png` — hero still (last frame of the gust animation).
- `loop.mp4` — the gust animation, 8 s, 1080 × 1080, 24 fps (not a loop).
- `vision-transition.mp4` — the human-eye → compound-eye clip, 7 s, 1080 × 1080, 24 fps; `vision-start.png` and
  `vision-ending.png` are its first and last frames.
- `nodes/` — the node trees: `main.png` (`PA_Compound eye_GN` in nine labelled sections), `vision-wave.png`,
  `fovea-stretch.png`, `cornea-cap.png`, `glass.png`, `petal.png` (the crumpled petal group), `petal-material.png`,
  `poppy.png`, `sky.png`.
- `tutorial/` — a node-by-node walkthrough of the second clip.

The frames were split between a Mac (Apple Metal) and a second PC with an RTX 4060 (OptiX); the same glass frame from
both matched at PSNR 52.5 dB.

## Caption

**Nodevember 2026 · Day 22 · Lens | Sunlit Facets**

A gust swings a poppy off the low sun, and the sun lights up facet by facet inside a compound eye. One poppy, one sun:
every repeat is Cycles refracting through 415 solid glass lenses on a sunflower-spiral Voronoi dome. No image textures.

#nodevember #nodevember2026 #GeometryNodes #b3d

Second post (`vision-transition.mp4`):

**Nodevember 2026 · Day 22 · Lens | Through an Insect's Eye**

A human view of a backlit poppy, then each of 415 glass facets switches its IOR from 1.0 to 1.48, rim first. One sun
becomes a cluster of suns. The bee-inspired false colour at the end is illustrative, not measured UV.

#nodevember #nodevember2026 #GeometryNodes #b3d

## Alt text

The view from inside a compound eye made of hundreds of irregular glass facets, filling a square frame. In the larger
central facets, many small, slightly different images of one glowing coral poppy repeat side by side. To the upper right,
a cluster of facets each holds a tiny four-pointed star of sunlight against a pale golden sky. Above them the facets turn
deep teal. Below, they show dark ground striped with long shadows and thin green leaves.

Second clip: a glowing red poppy against a golden evening sky, with the sun behind its right petals. The view widens,
then a ring of hexagonal glass facets with amber seams closes in from the edges toward the centre. Once it closes, the
poppy repeats in dozens of facets, a cluster of four-pointed sun stars sparkles at the upper right, and the petals fade
from red to blue-violet with yellow-green pollen.

## Posting

- [ ] Mastodon (mention @Nodevember@graphics.social)
- [ ] Bluesky (@nodevember.bsky.social)
- [ ] X (@Nodevember)
- [ ] Instagram (@nodevemberio)
- [ ] Blender Artists (tag: nodevember)
- [ ] Posted
