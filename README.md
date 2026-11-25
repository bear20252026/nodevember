# Nodevember

My entries for [Nodevember](https://nodevember.com), the November challenge for node-based art. One prompt a day.

Every piece is procedural, built with Blender 5.2 (5.3 from Day 17) Geometry Nodes and shader nodes, with no image textures and no
hand modelling. Days 1–8 come with the `.blend` file and the Python build script that generates it, so you can read
exactly how it is made and build it again yourself. From Day 9 on, a day folder holds a node-by-node tutorial and the
finished renders.

## Codevember archive

Sixteen Codevember 2026 works moved here from [paper-widgets](https://github.com/bear20252026/paper-widgets) on 2026-11-24: three complete sets (mrdoob, Yuri Artiukh and curllmooha) and thirteen single-prompt studies.

- [Open the Codevember archive](codevember/index.html)
- [Archive notes and credits](codevember/README.md)

The Codevember works keep their own credits and licences; they are not relicensed by this repository's MIT licence.

## 2026

| Day | Prompt | Piece | |
|---|---|---|---|
| 01 | Origami | **Paper plane.** A sheet of washi paper folds itself into a paper plane and glides off the stack. The sheet underneath is already waiting, so the 8-second loop is seamless. | [files](2026/day01-origami) · [loop](2026/day01-origami/loop.mp4) · [**node-by-node tutorial**](2026/day01-origami/tutorial/README.md) |
| 02 | Furniture | **A day in the corner.** A reading corner lit by one window, out of frame. In 10 seconds the sun crosses the room from raking morning light to a golden window on the wall, the lamp clicks on at blue hour, the moon comes through, and morning returns. Bouclé, walnut, travertine, pleated linen, knit, wool and glaze are all shader nodes. | [files](2026/day02-furniture-v3-corner) · [loop](2026/day02-furniture-v3-corner/loop.mp4) · [**node-by-node tutorial**](2026/day02-furniture-v3-corner/tutorial/README.md) |
| 03 | Stitch | **Kintsugi.** An old cream tea bowl breaks along its gold seams. The shards are glued back one by one with black urushi lacquer, which squeezes out of each seam, and then gold flows down every crack from the rim until the bowl is whole again. | [files](2026/day03-stitch-v3-kintsugi) · [loop](2026/day03-stitch-v3-kintsugi/loop.mp4) · [**node-by-node tutorial**](2026/day03-stitch-v3-kintsugi/tutorial/README.md) |
| 04 | Brass | **Chladni.** Sand on a brass plate finds the nodal lines of four rising tones: an X of arcs, a rounded square round a ring, a ring of loops, then lace. At each new tone the grains leap off the parts that shake and settle on the lines that stand still. One standing-wave formula, with Newton steps in a Repeat Zone. | [files](2026/day04-brass-v2-chladni) · [loop](2026/day04-brass-v2-chladni/loop.mp4) · [**node-by-node tutorial**](2026/day04-brass-v2-chladni/tutorial/README.md) |
| 05 | Clockwork | **Four-season music box.** A wind-up music box whose stage makes one turn per loop, and that turn is one year. The tree on it goes from snow through blossom, leaf and fruit to leaf-fall and back, and behind a wall of translucent enamel a pinned cylinder plucks a steel comb, one bar of the tune per season. The sound is synthesised from the same score as the pins, so picture and tune loop together. | [files](2026/day05-clockwork-v3-musicbox) · [loop with sound](2026/day05-clockwork-v3-musicbox/loop_sound.mp4) · [**node-by-node tutorial**](2026/day05-clockwork-v3-musicbox/tutorial/README.md) |
| 06 | Vault | **Rouen nave.** You lie on the floor of the nave of Rouen Cathedral and look up as you walk towards the rose window: four storeys of stone, pointed arches and a quadripartite rib vault, with every ochre stone of the cells laid course by course. The nave slides back one bay per loop, so the 10-second walk never ends. Rendered in Cycles, and again in EEVEE. | [files](2026/day06-vault-v5-rouen) · [loop](2026/day06-vault-v5-rouen/color/loop.mp4) · [EEVEE loop](2026/day06-vault-v5-rouen/eevee/loop.mp4) · [**node-by-node tutorial**](2026/day06-vault-v5-rouen/tutorial/README.md) |
| 07 | Tree | **After the rain — Supertree.** Eleven steel trees in an imagined Singapore garden at blue hour, inspired by the Supertree Grove at Gardens by the Bay. After the rain the garden wakes: violet-white light rises tree by tree through curved, flaring canopies, and a suspended skyway lights up between the two nearest trees. The crown framework is one connected graph of ribs, branches and ties, all in Geometry Nodes. A one-shot 8-second event, not a loop. Rendered in EEVEE. | [files](2026/day07-tree-v6-supertree) · [video](2026/day07-tree-v6-supertree/awakening.mp4) · [**node-by-node tutorial**](2026/day07-tree-v6-supertree/tutorial/README.md) |
| 08 | Mycelium | **Fingertip.** A weathered stone hand stands in fern moss on a forest floor and points one finger at the sky, with a low sun behind it. White hyphae leave the soil and climb the stone, cords gather up the raised finger, a hyphal knot swells on its tip, and a bonnet mushroom grows there, opens and sheds spores into the light. The hand is a skeleton of bones melted into stone by a signed distance field, and the mycelium is shortest paths over its mesh. A one-shot 15-second growth, not a loop. Rendered in Cycles. | [files](2026/day08-mycelium-v5-fingertip) · [video](2026/day08-mycelium-v5-fingertip/loop.mp4) · [**node-by-node tutorial**](2026/day08-mycelium-v5-fingertip/tutorial/README.md) |
| 09 | Winged | **Solo.** One silver maple key spins down through low sun, and the camera falls with it; the dark wood far below is only green and gold bokeh. The key is one closed surface, a sphere laid out over a single (s, v) field: the ribbed nut, the papery wing and its raised veins all come from that field, so the raking sun draws real shadow lines along the veins. It autorotates with a real key's numbers (an 18° cone, the spin axis through the centre of mass, about 6 cm of fall per turn), here about 30 times slower. Mid-loop a gust tips the spin over, and the key rights itself. A 12-second seamless loop, rendered in Cycles, plus a white clay video of its nine modifier sliders. | [files](2026/day09-winged-v5-solo) · [loop](2026/day09-winged-v5-solo/loop.mp4) · [sliders](2026/day09-winged-v5-solo/sliders/sliders.mp4) · [**node-by-node tutorial**](2026/day09-winged-v5-solo/tutorial/README.md) |
| 10 | Geode | **Geode generator.** A sawn geode on a black studio floor, and the one Geometry Nodes group that grows it. The whole stone is one implicit field on a voxel grid: its depth into the wall paints the agate bands on the polished face, and 10 242 fixed rays cast from the centre stand the crystals on the cavity wall, so when a slider moves every crystal glides instead of jumping. The 27-second video moves seven sliders one at a time (shape, wall thickness, bands, crystal size, tip, blade, colour zoning), then morphs through six classic kinds: amethyst, citrine, celestine, dogtooth calcite, druzy quartz and a solid agate. Rendered in Cycles, with a clean version and one with the slider readout. | [files](2026/day10-geode-v2-generator) · [video](2026/day10-geode-v2-generator/sweep/loop.mp4) · [with readout](2026/day10-geode-v2-generator/sweep/sweep.mp4) · [**node-by-node tutorial**](2026/day10-geode-v2-generator/tutorial/README.md) |
| 11 | Cavernous | **Flooded geode canal.** A small boat with a lantern drifts down a chain of giant flooded geodes: an amethyst hall, a hall of water-clear quartz with milky roots, a citrine dome, and on into pale blue celestine. Every hall is the Day 10 geode generator's own field and crystal groups, scaled 150 times. A chamber is a function of its number alone, and every point asks only the two nearest chambers, so the chain could run on for ever at the same cost per point. In the passages between the halls the crystals change kind one by one, with odds that slide across the bore, and the boat's Kelvin wake breaks the reflections behind it. The lantern is the only light. A 34-second video, rendered in Cycles. | [files](2026/day11-cavernous-v8-canal) · [video](2026/day11-cavernous-v8-canal/loop.mp4) · [**node-by-node tutorial**](2026/day11-cavernous-v8-canal/tutorial/README.md) |
| 12 | Erosion | **Sugar cube.** Nine drops of tea fall on a sugar cube on a white saucer, lit from behind. The first ones soak in and stain the top brown, the next drill a funnel down through it, tea pools around the base and wicks up the sides, the corners round off, and the cube slumps into a ragged ring of brown crystals in a puddle of tea. The cube is one implicit field (a rounded box whose corners dissolve first, minus the funnel), and its crystals are a fixed 3D lattice drawn only near the field's surface, so the same grains are uncovered and then lost without flicker. Light comes through the thin edges by walking the field toward the lamp. One Age slider drives it all, with no simulation. An 8-second video, rendered in Cycles. | [files](2026/day12-erosion-v3-sugar-cube) · [video](2026/day12-erosion-v3-sugar-cube/loop.mp4) · [**node-by-node tutorial**](2026/day12-erosion-v3-sugar-cube/tutorial/README.md) |
| 13 | Dune | **Sandworm.** A colossal worm stands out of an orange dune, its round maw lined with thousands of fine needles turned to the camera. Its neck sways, the ring muscle round the mouth draws the opening in and lets it go, sand pours off its rings in thin streams and dust breathes out of the hole. It rides a track it never leaves: the path's pitch and heading are functions of arc length, and the body is just the stretch of track behind the head, so the hole stays put. Head and body are one closed tube, armoured with telescoping rings, slabs and a rocky crust, and each falling grain is placed where the hide was when it left. A 6-second seamless loop, rendered in Cycles. | [files](2026/day13-dune-v2-sandworm) · [video](2026/day13-dune-v2-sandworm/loop.mp4) · [**node-by-node tutorial**](2026/day13-dune-v2-sandworm/tutorial/README.md) |
| 14 | Shell | **One tube, every shell.** A chambered nautilus in a black studio melts into an ammonite, a garden snail, a tower shell, a textile cone, a conch and a cockle, and ends on an abalone that turns over to show its mother-of-pearl. All eight are one Geometry Nodes group built on David Raup's 1966 coiling model: one closed curve, grown W times a turn, kept a share D from the axis, slid T down it, and shaped by S, plus a lean that lets the abalone's mouth face down. The ribs, holes and every colour pattern are drawn from the shell's own coordinates, so the video is just the sliders keyed from one kind to the next. Rendered in Cycles. | [files](2026/day14-shell-v1-morphospace) · [video](2026/day14-shell-v1-morphospace/loop.mp4) · [**node-by-node tutorial**](2026/day14-shell-v1-morphospace/tutorial/README.md) |
| 15 | Pearl | **Nacre dive.** One camera move from a whole Tahitian pearl on a white sweep down to the surface its lustre comes from, and back out. Past the fine wavy growth lines a loupe shows, the surface turns into terraces of irregular aragonite tablets, 8 µm across and 0.45 µm thick, each layer its own thin film in green or rose; the key light sweeps across them while the camera circles. One growth-height field decides it all: where it crosses a whole layer, a layer ends, which is a terrace step close up and a growth line from a millimetre away. The material draws those terraces on the whole pearl, and real tablet geometry takes over at the dive point below 1.2 mm frame width, with the same film on both so the hand-off doesn't pop. Rendered in Cycles. | [files](2026/day15-pearl-v2-nacre-dive) · [video](2026/day15-pearl-v2-nacre-dive/loop.mp4) · [**node-by-node tutorial**](2026/day15-pearl-v2-nacre-dive/tutorial/README.md) |
| 16 | Wave | **Comb jelly.** A sea gooseberry, a comb jelly about 15 mm long, hangs in black water, then swims: its eight comb rows beat one paddle after another, so a wave runs down every row from the apical organ to the mouth, and the moving paddles scatter the light into flecks of red, green and blue that travel with it. The wave is a delay (each plate starts its beat a little after its neighbour), the colour comes from where a plate is in its stroke, and a stop front runs down the rows the same way until the animal coasts to rest. Body, 192 plates, organs, canals, two tentacles with 270 filaments and the marine snow all come from one Geometry Nodes tree; the jelly is a faint scattering volume, shot at macro depth of field. Rendered in Cycles with sensor-style grain, slowed about 10× from life. | [files](2026/day16-wave-v1-comb-jelly) · [video](2026/day16-wave-v1-comb-jelly/loop.mp4) · [**node-by-node tutorial**](2026/day16-wave-v1-comb-jelly/tutorial/README.md) |
| 17 | Caustics | **Five cuts of light.** A cut-crystal decanter stands in a dark room under one low sun, seen straight down, and turns 30° while its cut morphs through five classic patterns of cut and pressed glass: flutes, swirl, diamond thumbprint, honeycomb and hobnail. The table shows only the light that went through the glass, and it re-weaves itself with every cut, from a fan of straight bands to rows of bright drops, each focused by one round dome. That light is ray-traced in Geometry Nodes, about 6.4 million sun rays a frame, each split into five wavelengths that bend by different amounts, so its edges carry thin rainbow fringes; the glass the camera sees uses Blender 5.3's new spectral dispersion with the same formula. A 14-second video, rendered in Cycles. | [files](2026/day17-caustics-v3-cut-glass) · [video](2026/day17-caustics-v3-cut-glass/loop.mp4) · [**node-by-node tutorial**](2026/day17-caustics-v3-cut-glass/tutorial/README.md) |
| 18 | Prism | **Twisted prism wall.** Twenty-eight tall glass bars with a triangular section stand side by side on black, seen straight on, and twist in a travelling wave while each rolls a third of a turn per loop. The only light is a plain vertical white slit hidden behind the wall, which the camera itself cannot see. Each bar bends the line of sight by an amount that depends on how far it is turned at that height, so the slit shows only where a bar is aimed at it: the twist strings those places into diagonal ribbons of colour and dotted white arcs that slide down the wall, and Blender 5.3's dispersion splits each one into a spectrum. One 28-node Geometry Nodes tree, no lamps, no coloured light; an 8-second loop rendered in Cycles. | [files](2026/day18-prism-v3-opgrid) · [video](2026/day18-prism-v3-opgrid/loop.mp4) · [**node-by-node tutorial**](2026/day18-prism-v3-opgrid/tutorial/README.md) |
| 19 | Shimmer | **Diamond dust.** Sunrise on a frozen, snow-covered lake: the still air fills with drifting ice crystals and the sky builds the display real diamond-dust mornings show, a sun pillar, two sun dogs 22° either side of the sun with red inner edges, the upper tangent arc and the 22° halo. Every halo is ray-traced in Geometry Nodes: 9 million rays a frame, each with its own wavelength, pass through hexagonal ice by Snell's law and Fresnel reflection and are counted on the sky as light. Near the lens single crystals flash, more often where the traced halo is bright, so over a few seconds the glitter draws the arcs: a halo is shimmer, added up. A 12-second sunrise rendered in Cycles. | [files](2026/day19-shimmer-v2-sundogs) · [video](2026/day19-shimmer-v2-sundogs/loop.mp4) · [**node-by-node tutorial**](2026/day19-shimmer-v2-sundogs/tutorial/README.md) |
| 20 | Smoke | **Cream plume.** Macro close-up of dense ivory cream billowing into warm rose-tinted water. Thirteen staggered nozzles — one smooth hero dome beside twelve noisy micro-jets and a faint background veil — feed a 3D incompressible Navier-Stokes solver built directly from Blender 5.3 Geometry Nodes grid nodes (RK2 midpoint velocity advection, BFECC cream advection, vorticity confinement, dual-scale curl disturbance and Fixed-boundary Poisson pressure projection). Shaded with an energy-conserving Principled Volume at 20 volume bounces so sunlit crests stay velvety vanilla while deep crevices glow warm peach-rose; no Mantaflow, no external VDBs. A 3-second slow-motion bloom rendered in Cycles. | [files](2026/day20-smoke-v10-cream-plume) · [video](2026/day20-smoke-v10-cream-plume/loop.mp4) · [**node-by-node tutorial**](2026/day20-smoke-v10-cream-plume/tutorial/README.md) |

<p>
  <img src="2026/day01-origami/_still_086.png" width="49%" alt="The washi sheet folded into a dart on a stack of paper">
  <img src="2026/day01-origami/_still_160.png" width="49%" alt="The paper plane standing on its keel, lifting off the stack">
</p>

<p>
  <img src="2026/day02-furniture-v3-corner/_still_076.png" width="49%" alt="A reading corner at noon: sun through an unseen window falls across a cream bouclé barrel chair, a walnut side table with a travertine lamp, and a vase of pampas grass">
  <img src="2026/day02-furniture-v3-corner/_still_211.png" width="49%" alt="The same corner at night: the pleated linen lamp is on and warms the room, and moonlight draws the window faintly on the wall">
</p>

<p>
  <img src="2026/day03-stitch-v3-kintsugi/_still_001.png" width="49%" alt="A cream tea bowl with fine crazing, its cracks mended with flat gold lines">
  <img src="2026/day03-stitch-v3-kintsugi/_still_128.png" width="49%" alt="The same bowl with every shard back in place, the seams still black urushi lacquer before the gold">
</p>

<p>
  <img src="2026/day04-brass-v2-chladni/render.png" width="49%" alt="A square brass plate on a thin shaft in a black void, white sand drawn into a rounded square around a ring at the centre bolt">
  <img src="2026/day04-brass-v2-chladni/_still_220.png" width="49%" alt="The same plate on the highest tone: the sand has settled into dense nested loops like lace">
</p>

<p>
  <img src="2026/day05-clockwork-v3-musicbox/_still_090.png" width="49%" alt="A brass music box with a pierced band of green and amber enamel under a tall glass cloche; on its grass stage a small twisted tree is a cloud of pink blossom">
  <img src="2026/day05-clockwork-v3-musicbox/_still_240.png" width="49%" alt="The same music box in autumn: the tree has turned orange and red apples lie fallen on the grass">
</p>

<p>
  <img src="2026/day06-vault-v5-rouen/render.png" width="49%" alt="Looking up the nave of Rouen Cathedral: grey four-storey walls lit by patches of low sun climb into an ochre rib vault with a rosette boss in every bay, and the rose window far ahead">
  <img src="2026/day06-vault-v5-rouen/masonry_detail_square.png" width="49%" alt="Close-up of the upper vault: ochre stones laid in courses in each cell end cleanly on the moulded diagonal ribs at a carved rosette boss">
</p>

<p>
  <img src="2026/day07-tree-v6-supertree/_still_001.png" width="49%" alt="Blue hour in a garden of tall steel trees before the lights: dark violet crowns, planted trunks lit green from below, a skyway between the two nearest trees">
  <img src="2026/day07-tree-v6-supertree/render_1080.png" width="49%" alt="The same garden awake: every crown glows violet-white through black radial ribs, the skyway glows pink and gold, and wet paths reflect the light">
</p>

<p>
  <img src="2026/day08-mycelium-v5-fingertip/render-wide.png" width="49%" alt="A stone hand in fern moss points one finger at the sky, its stone laced with white mycelium; a small pale mushroom stands on the fingertip, its cap glowing in the backlight against a dark forest">
  <img src="2026/day08-mycelium-v5-fingertip/render.png" width="49%" alt="Close-up of the pale bonnet mushroom on its thin pink stem, the gills lit from behind by a low golden sun and spores drifting through the light, above the fingertip wrapped in white threads">
</p>

<p>
  <img src="2026/day09-winged-v5-solo/render.png" width="49%" alt="A pale silver maple key, a ribbed brown nut flowing into one papery wing, tipped over by a gust against a near-black background; low sun from the right rakes across its raised veins, and green and gold bokeh drifts behind it">
  <img src="2026/day09-winged-v5-solo/_still_173.png" width="49%" alt="The same key half a second later, its wing turned broadside with the veins fanning from the nut, as specks of dust float past">
</p>

<p>
  <img src="2026/day10-geode-v2-generator/render.png" width="49%" alt="Two halves of a sawn amethyst geode on a black studio floor: a rough reddish rind, lavender and blue-grey agate bands, white quartz, and a hollow lined with glassy purple points that catch small white highlights">
  <img src="2026/day10-geode-v2-generator/_still_494.png" width="49%" alt="The same generator set to celestine: a pale white rind and a hollow packed with pale blue, flat bladed crystals with chisel ends, on black">
</p>

<p>
  <img src="2026/day11-cavernous-v8-canal/render.png" width="49%" alt="A small boat with a hooded figure and a hanging lantern on black water inside a giant amethyst geode; purple points line the walls, and ahead a passage lined with clear quartz opens into the next hall">
  <img src="2026/day11-cavernous-v8-canal/render-600.png" width="49%" alt="The boat in an orange citrine dome, the passage ahead ringed in pale blue celestine, and its V-shaped wake breaking the reflections of the crystals into slanted strips">
</p>

<p>
  <img src="2026/day12-erosion-v3-sugar-cube/render.png" width="49%" alt="A sugar cube on a white saucer, lit from behind, with a funnel drilled into its top; the upper corners are still white and glittering, the lower half is soaked brown, and a small puddle of amber tea spreads around its base">
  <img src="2026/day12-erosion-v3-sugar-cube/render-end.png" width="49%" alt="What is left after the last drop: a ragged ring of brown sugar crystals standing in a wide, shallow pool of amber tea, a white highlight on the liquid">
</p>

<p>
  <img src="2026/day13-dune-v2-sandworm/render.png" width="49%" alt="A giant ringed worm of rocky, sand-coloured hide rises out of an orange dune and bends over, its round mouth lined with fine pale needles around a dark throat facing the camera, dust drifting at its base under a hazy orange sky">
  <img src="2026/day13-dune-v2-sandworm/render-113.png" width="49%" alt="The same worm a little later, its neck swung the other way, thin streams of sand pouring off the ledges of its rings">
</p>

<p>
  <img src="2026/day14-shell-v1-morphospace/render-001.png" width="49%" alt="A cream chambered nautilus with orange flame stripes that fade towards its smooth, wide aperture, seen from the side on black">
  <img src="2026/day14-shell-v1-morphospace/render.png" width="49%" alt="The last kind, an abalone turned over: a shallow ear-shaped bowl lined with pale iridescent mother-of-pearl, a small spire curled at one end and three open holes along the rim, on black">
</p>

<p>
  <img src="2026/day15-pearl-v2-nacre-dive/render-060.png" width="49%" alt="A dark Tahitian pearl on a pale grey sweep, its mirror-like surface reflecting the studio in mauve and sea-green, a small bright highlight up-left">
  <img src="2026/day15-pearl-v2-nacre-dive/render.png" width="49%" alt="Close in on the pearl's surface: irregular rounded polygonal tablets in overlapping layers like terraces, a band of sea-green tablets between mauve ones, the light glowing pink on the lower right, the far tablets soft in the depth of field">
</p>

<p>
  <img src="2026/day16-wave-v1-comb-jelly/render.png" width="49%" alt="A clear egg-shaped comb jelly in black water mid-swim, eight milky comb rows with red, green and blue flecks along their rims, a white pharynx and two tentacle sheaths inside, thin fringed tentacles hanging below">
  <img src="2026/day16-wave-v1-comb-jelly/render-200.png" width="49%" alt="The same animal later in the swim, with fewer red, green and blue flecks left along its rim as the rows begin to go quiet, the two fringed tentacles streaming below">
</p>

<p>
  <img src="2026/day17-caustics-v3-cut-glass/render-150.png" width="49%" alt="Seen from above on black: a cut-glass decanter as bright rings at the left edge, and to its right a fan of warm light on the table broken into a lace of rhombic patches with bright edges">
  <img src="2026/day17-caustics-v3-cut-glass/render.png" width="49%" alt="The same decanter later, cut as hobnail: the light on the table gathers into rows of bright teardrop-shaped spots, each focused by one round dome of glass, with faint rainbow fringes on their rims">
</p>

<p>
  <img src="2026/day18-prism-v3-opgrid/render.png" width="49%" alt="Twenty-eight vertical glass bars on black, seen straight on: a broad band of blue, green, gold and red light across the upper half, a dotted white line climbing from lower left to upper right, short white dashes and coloured slivers below">
  <img src="2026/day18-prism-v3-opgrid/render-097.png" width="49%" alt="The same wall halfway through the loop: the dotted white arcs and ribbons of red, green and teal have slid down the bars, and a dotted line now climbs from the lower left to the top right corner">
</p>

<p>
  <img src="2026/day19-shimmer-v2-sundogs/render-090.png" width="49%" alt="Sunrise over a frozen, snow-covered lake: the sun sits on the far shore between two dark spruce headlands, a thin pillar of light rises from it and runs down the snow as a glitter path, and a small bright sun dog glows at the inner tip of each headland">
  <img src="2026/day19-shimmer-v2-sundogs/render.png" width="49%" alt="The same lake later in the sunrise: the sun has lifted clear of the shore, bright sun dogs with red inner edges glow beside the trees, a faint 22° halo arcs over the sun with a bright V-shaped tangent arc at its top, and glittering ice crystals are scattered through the air">
</p>

<p>
  <img src="2026/day20-smoke-v10-cream-plume/render-048.png" width="49%" alt="Macro view of dense warm ivory cream billowing from the left into soft dusty-rose water at mid-bloom, a plump hero dome curling forward above a rose-lit valley">
  <img src="2026/day20-smoke-v10-cream-plume/render.png" width="49%" alt="Frame 64 hero still: tightly curled vanilla-ivory mushroom caps fill the left two-thirds with glowing peach-coral crevices and soft dissolving mist edges against dusty-rose water">
</p>

## What is in a day folder

Days 1–8 hold all of these. From Day 9 on, a folder holds `tutorial/`, the renders, the node screenshots and `post.md`.

| File | |
|---|---|
| `build.py` | builds the whole scene: node trees, materials, lights, camera, render settings |
| `*.blend` | the result of `build.py`; open it to explore the node trees |
| `loop.mp4` | the render, 1080 × 1080 (`loop_sound.mp4` adds the sound, where there is one) |
| `_still_*.png` | full-quality stills |
| `nodes*.png`, `nodes/` | node-tree screenshots |
| `nodes_layout.json` | node positions and frames, tidied by hand; `build.py` restores them |
| `post.md` | idea, build log, captions and alt text |
| `tutorial/` | a walkthrough of the node tree, where there is one |
| `sliders/` | a second video: the piece's modifier sliders moved one by one, where there is one |
| `color/`, `eevee/`, `clay/` | a render copy and its loop per engine, where a piece was rendered more than one way |

## Rebuild a piece

Days 1–8 can be rebuilt. You need Blender 5.2 and, for the video, ffmpeg.

```sh
cd 2026/day01-origami
blender -b --factory-startup --python build.py     # writes origami.blend
../../lib/render_frames.sh origami.blend 30         # PNG frames → loop.mp4
```

`lib/proc_blender.py` is a small helper library that every build script uses. It is a builder for node graphs, plus
layout, a seamless loop clock, a studio setup and render helpers. `lib/render_frames.sh` renders a frame sequence and
retries if Blender crashes, then encodes the MP4.

## License

All rights reserved. This is a private project, shared for learning and study only. You may view, download and run
the pieces to learn how they are made, but not redistribute them, use them commercially, present them as your own or
use them to train models. See [LICENSE](LICENSE).
## Linked Codevember sets

Two complete Codevember 2026 sets are linked rather than copied (85 MB and 292 MB), and are **not counted in the twenty Nodevember studies or the sixteen archived Codevember works**:

- [Spite — Codevember 2026](https://spite.github.io/codevember-2026/) — one real-time three.js sketch per day through Day 25, each with a photographic PBR look, seeded randomness and a "How it works" page. **Classified: Codevember · complete set.** [source](https://github.com/spite/codevember-2026)
- [Theo Tillberg — Codevember 2026](https://ttillberg.github.io/codevember-2026/) — sixteen published days of the same prompt list, each a small standalone experiment. **Classified: Codevember · complete set.** [source](https://github.com/ttillberg/codevember-2026)

This repository itself is a fork of [yapitw/nodevember](https://github.com/yapitw/nodevember); that upstream is the source of the twenty studies already here, not a separate arrival.
