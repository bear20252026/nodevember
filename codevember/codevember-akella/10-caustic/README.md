# 10-caustic

A flight down a winding tunnel whose whole wall is sea-bottom sand under caustics: there is no water surface, the
sand is "down" all the way round. Rapana lie on it, grey mullet keep close over it in spirals, eelgrass bows in the
current, and schools of hamsa go through the open water and part round you. Drag to look round, double click to
look ahead again, wheel to fly faster or slower, space to stop. The panel (closed) has everything else.

`npm run dev` (port 5310 with `PORT=5310`), or `portless` for https://caustic.localhost.

The rapana is a scanned shell: "Рапан ракушка" by caplazavrmem on Sketchfab, CC-BY 4.0 (`public/rapan.glb`).

## How it works

The wall unrolled is a flat sheet (round the tunnel × along it,
repeating after three times its girth), so everything is made in that sheet. The sand is baked once on the GPU
(`terrain.wgsl`, 1024×3072, about 55 ms): ripples and dunes are phasor noise, wave packets summed as complex
numbers with only the phase kept, so every ripple is as tall as the next; read through a slow warp the crests
meander, and where a cell's packets fall out of step a crest forks or ends. A lopsided profile gives each ripple a
long face toward the light and a short steep one away. Rocks are what is left under a handful of leaning planes,
each cut rounded into the next and the whole pitted at finer scales, half buried, with a scoured moat; then slopes, soft shadows along the light's lean and hollows are baked beside
the heights. The caustics (`light.wgsl`) are a grid of light, a point a texel, on an imaginary rippling sheet a
little above the sand, drawn straight into a map of the wall. The sheet's waves are whole turns round the tunnel
and along it; their slopes and curvature are summed once a frame into small textures (summing them per point was
16 ms). A compute pass lands each point on a blurred copy of the sand (a step of fixed point and three of secant:
on the true heights nothing settles on a rock's steep side, and the light there flickered), and works out its
brightness exactly, as one over det(1 + depth × curvature) over the sand's slope along the ray. A fold is far
thinner than the grid is fine, so it is widened by as much as that changes across one cell; measured off
triangles or neighbours instead, every fold was a string of beads. So the web tightens in hollows and loosens
over dunes and rocks, and holds still. The map also keeps which way the light was bent, and the wall reads red
and blue a little to either side along it. The wall (`scene.wgsl`) is a tube of rings on a fixed grid, a texel
apart at the eye and coarser in bands beyond. Living things (`life.ts`, `life.wgsl`): rapana shells (a scanned model,
`public/rapan.glb`: "Рапан ракушка" by caplazavrmem on Sketchfab, CC-BY 4.0; read straight out of the glb with
its picture, always laid mouth to the sand as a living one goes, and creeping canal first) and
schools of four or five grey mullet that keep close over the sand, belly to the wall, wherever round the tunnel
they are; a wave runs down each body and it bends into its turns. The mullet are silver: most of a flank shows
what lies round it (lit sand flickering with the caustics, the haze up and down the tunnel) under a net of
scales, and the light itself, which here is the whole middle of the tunnel, a line: so a rounded side carries a
bright streak down its length that slides round as the fish rolls, banks and winds round the tunnel (the schools
go in spirals). A fish's height is worked out along its own path: the sand's broad shape (read back from the GPU
after each bake, rocks counted in) a second behind and two ahead, a soft greatest of it under a bell that falls
to nothing at both ends, so it rises well before a stone and comes down well after. Eelgrass (Zostera marina) grows in meadows where a slow noise is high: each leaf a ribbon of ten pairs
bent over in an arc the way the water runs, gusting in waves that travel along the tunnel; far leaves are drawn
a pixel wide and thinned in coverage. Hamsa (Black Sea anchovy) go in schools through the open water: each fish
swims its school's path a little later than the leader and a little off it, so a school is a ribbon along its own
trail, bunched to a ball when it slows and drawn out when it darts, and every swerve passes down it fish by fish;
they bank hard into a turn, the silver flank comes up to the light, and the flash travels through the school. They
keep off the sand and part round the eye (each remembers which side it leans to, turning only so fast, or a fish
headed straight at the eye leaps across it). All their shadows are drawn each frame into another map of the wall.
Shafts of light (`shaft.wgsl`, off by default: panel "water", "shafts of light"): each pixel's line of sight is walked through the water at half size or less (24
steps, 0.5 ms), reading the caustic map where that step's light will land, the more blurred the higher up, against
the light round about; only the unevenness is added, the even part being the haze. Seen along the tunnel they are
rays out from its vanishing point. Specks in a shaft can be lit by it ("specks catch the shafts", off too). The
water is clear up to a little way off, then hazes toward a deeper blue (panel: water).

## Tools, and the loop

`tools/tunnel-shot.mjs` renders the page headless with real WebGPU (`AT=`, `SET=`, `DPR=`, `DRAG=`);
`tools/tunnel-prof.mjs` gives each pass's cost, by leaving it out.

`?loop=30` (or "loop, seconds" under "flight") makes the page repeat exactly every that many seconds: the eye goes
one length of the tunnel in it, and every other motion is brought to a whole number of turns in that time (the
light's waves, the eye's sway, each school's way along and round the tunnel, tail beats, the eelgrass's gusts; the
shells stop creeping, the specks stop drifting). `tools/tunnel-film.mjs` records one such loop frame by frame and
has ffmpeg make an mp4 of it: `DPR=2 SIZE=1080 LOOP=30 node tools/tunnel-film.mjs output/tunnel-loop.mp4`.

## The other pages

More experiments on the same word, each its own page with a panel (closed) and a headless shot tool in
`tools/<page>-shot.mjs` (`tools/shot.mjs` for the first).

- **`creatures.html`: light gathers into creatures.** Light through moving water, on a stone floor. Every twelve seconds the light near the middle gathers into a hand-drawn creature (a fish, a swallow, a jellyfish), holds it, then lets go through turbulence and runs back into the water's net. Move the cursor to stir the light; it settles back.
  After Baeza, Gross & Günther, [Controllable Caustic Animation Using Vector Fields](https://www.vc.tf.fau.de/publications/BaezaRojo20EGshort/) (Eurographics 2020 short).

  - **Photons** (`src/shaders/photons.wgsl`): about 2M, one per point of a grid over the screen. Each frame each
    is refracted, by Snell's law, through a sum of plane waves (`makeWaves`, each a whole number of turns
    per loop) onto the floor, red, green and blue with slightly different indices. Each photon is then splatted
    with atomics into a light buffer, smoothed over a few frames and a pixel or so (the density estimate), and
    given a glow.
  - **Matching** (`src/transport.worker.ts`): a lead photon in every 6 x 6 block is matched to a point of the
    drawing by sliced optimal transport. The worker draws the strokes on a canvas and samples them by
    brightness, then repeatedly sorts leads and targets along a direction and moves each lead to its quantile.
    Leads carry weights (how many of the photons round them join), so the weighted 1D map is quantile
    matching. Other photons interpolate between their four leads, or take the nearest where the leads went to
    different strokes.
  - **Who joins**: every photon near the drawing, and ever fewer further out (`inner`, `outer`, `far`),
    decided per photon by a hash, so the net drains round the creature with no edge.
  - **The flow** (`src/shaders/grid.wgsl`), as in the paper: each lead wants to go straight to its target,
    arriving as the transition ends, at `(target - here) / (1 - s)`. Those wishes are fitted on a 160-wide
    grid by least squares with a smoothness term (Jacobi, warm started). A pressure solve then takes out as
    much of the divergence as `liquid` asks, and curl noise is added, strongest mid-transition. Photons ride
    the field, and after `tau` (0.85) they hand over to their own straight path, so they land exactly. Light
    in the drawing dims towards `rho` as it gathers (the paper's flux blend).
  - **Stir**: the cursor drives a small stable-fluids grid. Its velocity pushes photons, and in the held
    states (water, drawing) any displacement relaxes back.
  - **Show**: free 2.4 s, gather 3.4, hold 2.2, dissolve 3.8, per creature; 35.4 s loop.

  `tools/shot.mjs` renders headless with real WebGPU: `AT=7,18.8 node tools/shot.mjs out.png 1280x720`
  seeks the show to those seconds; `STIR=60` drags across first, `BENCH=1` prints GPU ms per frame.
- **`glass.html`: a pebble that hides a picture.** Inverse caustic design after Schwartzburg et al. 2014 and
  Matt Ferraro: a worker transports uniform light onto an eye, a skull or the word CAUSTIC (sliced OT onto the
  picture turned 180°, so the rays cross), sets each lens cell's normal by Snell's law, integrates heights with
  a cosine-transform Poisson solve, then traces the made surface and re-solves three times. The light is traced
  live through the real underside, never baked: level and at its height the picture forms, tilted it knots into
  cusps. Drag to spin and tip, wheel to raise; after a few idle seconds it plays its own show.
- **`beams.html`: frozen light.** A twisted glass ring in fog. 262k photons are traced through its SDF
  (refraction, Fresnel, total internal reflection, three indices); each run through the air is kept as a beam
  with its power and optical path length, after Jarosz et al.'s photon beams. Beams are ribbons weighted by how
  their bundle of neighbours narrows, so focused light reads as sheets and spray fades away. Shift-drag moves a
  white plane through them; the pulse lights only beams whose path length sits behind a moving front.
- **`catastrophe.html`: the catastrophe machine.** Each texel is a diffraction catastrophe integral
  (Pearcey, swallowtail, butterfly), integrated live along the real axis with rotated tails past the last real
  root of every derivative. The organism is a drifting, bending slice through the butterfly's four
  parameters; the cursor pushes the two highest, so cusps are born and annihilated. `net` mode is Fresnel
  diffraction of a random phase screen by GPU FFT.
- **`prism.html`: spectral calligraphy.** A breathing trefoil knot under a sweeping slit of light, traced in 8
  wavelength bands (Cauchy index, dispersion exaggerated). Each band's landed photon grid is drawn as a light
  mesh (brightness = source area / landed area, torn where neighbours took different paths), so the ribbons
  stay sharp; CIE matching turns the bands into colour that sums to white.
- **`pool.html`: a little pool, anime style.** A painted stone pool in the sun; click the water to throw a
  beach ball, a stone, a glass marble or a handful of sakura petals (tray at the bottom, or keys 1 to 4),
  drag to stir. The water is a wave-equation heightfield (after Evan Wallace's WebGL Water) plus standing
  breeze ripples sized by curvature, so each one focuses about 0.5 m down. Things push it by the change in
  the water column they fill. The light is a light mesh: a 640 x 427 grid of sun rays refracted through the
  surface (shaded by floats and petals, bent again by marbles) and drawn onto the floor's plane, each
  triangle as bright as it is squeezed; then thresholded into white lines with a cyan glow. Walls read
  their light from that plane carried on past them. Glints are four-point stars where the sun's
  reflection meets the eye. `tools/pool-shot.mjs` (THROW, DRAG, AT, UI), `tools/pool-prof.mjs` (GPU ms per
  pass), `tools/pool-probe.mjs` (body positions over time).
- **`vessel.html`: a vessel of glass threads.** By default the web is a foam: a two-scale Voronoi network on the
  vessel's unrolled skin (wrapping round, each main strand its own weight, a sparser finer net, thickened
  junctions, a scalloped crown ring and a foot ring), made into glass once. It can instead be grown: a physarum web (Jeff Jones's agents) grows on the
  vessel's unrolled skin, two skins deep, fed by a caustic traced onto the same sheet (whole numbers of waves
  round it, so it wraps): the slime grows along lines of focused light. Every other frame the softened web's
  ridges (found with its Hessian, placed on the peak between texels, carrying the strand's direction) become
  capsule seeds, and a jump flood gives each texel its nearest; knots are blocks stronger than their
  neighbours, flooded on a grid four times coarser, and grow thorns, a spiked crown and a frayed hem. The glass
  is ray marched from those fields (exact tube normals, strands thinner than a pixel drawn wider and fainter),
  with a cyan glow inside, glints on thorn tips and drifting specks; temporal anti-aliasing (Halton jitter, variance
  clipping, history reprojected by the vessel's turn through the first strand's depth, Catmull-Rom fetch). Drag to turn
  it, space to hold it still; W (or the panel) shows
  the web lab, the sheets laid flat. `grown from` switches foam, physarum, caustic, or physarum fed on caustic.
  `tools/vessel-shot.mjs` (AT, SET, DRAG), `tools/vessel-prof.mjs` (ms per stage, SKIPS bitmask).
- **`lattice.html`: the vessel as a real mesh.** The same idea as `vessel.html`, a hundred times cheaper. The foam is
  built on the CPU as a graph (`src/lattice/geometry.ts`): each cell's polygon is clipped from its neighbours'
  bisectors on the vessel's unrolled, wrapping skin, so every edge comes out once with both junctions, and the cuts
  along the crown and the foot are the rim rings. Edges are warped by a noise of position alone (so they still
  meet), mapped onto the outline and swept into tubes (parallel-transport frames) that swell towards their
  junctions; some cells get a thinner chord. Crown spikes, thorns and hanging threads are tapered tubes. Drawn
  additively (glass that glows more than it hides needs no sorting) with 4x multisampling. By default the web is
  one surface rather than tubes ("one surface" in the panel): on a 1.5 mm grid over the skin, g is a smooth
  minimum over nearby strands of (distance minus radius), so strands melt into filleted junctions; wherever g < 0
  the glass is as thick as a round tube of the nearest strand would be, capped at its radius (fillets become flat
  webs), with exact normals from the gradient of sqrt(d^2 + h^2) - r, and marching squares cut the outline so the
  two faces meet on it. Built in a worker (about 3 s, 4M triangles); about 3 ms a frame at retina. Drag to turn, wheel to come closer, space to hold still.
  `form` (panel) puts the lattice on another surface (`src/lattice/form.ts`): Suzanne for now (day 11's watertight
  remesh, `public/suzanne.mesh.bin`). Seeds are scattered evenly over the mesh, and the strands are where the
  surface crosses the 3D Voronoi walls between neighbouring seeds (a plane distance per neighbour, no graph). The
  same filleted surface is grown on the mesh's own triangles, split finely only near strands, with marching
  triangles; a depth pass of the form dims the glass behind its front, and the form's normal shades the glass
  (edges brighter, planes facing up a little lit) so a face reads through it. Each form has its own preset. The
  finer net is hierarchical: a chosen main cell is split by all the walls between the finer seeds inside it, so no
  strand ends in the air. The glass is shaded as rods (Fresnel edges, streaks from three soft-box lights, a sharp
  sparkle) and blended so its middles darken what is behind; bloom takes only light above a threshold. Depth of field
  by layers: glass adds light, so the picture is a sum and can be blurred piece by piece. Each fragment shares its
  light between a sharp layer (full size, multisampled) and three half-size layers by how out of focus it is (focus
  on the near side of the form); the three are blurred by a quarter, a half and all of the most blur (separable
  Gaussians) and added back. What lies behind a sharp strand is blurred right under it, with no outline. About
  6.5 ms a frame at retina. It wraps itself on (panel: wrapping, or drag "wrapped" from 0 to 1 by hand): a front rises from the
  bottom, made uneven by a 3D noise on the form so some patches wrap well ahead of others; glass below it is in
  place, above it not yet there, and just behind it stands off the form (out along the form's normal, a little
  down) and settles as the front moves on, so strands crossing the front curl
  outwards before they lie down; a hot edge glows where it has just appeared and the light inside gathers as the
  glass closes. It holds, unwraps from the top, and loops. All in the vertex shader (glints and the blurred layers
  follow), no rebuild.
  `tools/lattice-shot.mjs` (FORM=suzanne), `tools/lattice-prof.mjs`.
