# 17-kelp

Weed that keeps growing up the picture's diagonal, the sun behind it and coming through it, and the eye going
with it. Once a loop it grows over a stone monkey that hangs in its way, and the fish that had gone out to the
stone bolt back into the weed's shade. It loops every 12 seconds, and nothing in it is simulated.

That is the page (`index.html`, `src/tangle.ts`), and it is told below under "Weed that keeps growing". It
came last. Before it, and still here: a kelp the eye closes in on (`zoom.html`), which the next three parts
are about and whose water, snow and lens the page uses; and a shape made of seaweed (`suzanne.html`,
`venus.html`), whose weed and whose sun map (`src/deep.ts`) the page is made of.

```sh
portless            # https://kelp.localhost
npm run dev         # or a numbered port (the tools expect 5317: npx vite --port 5317)
```

## The first page: a kelp the eye closes in on (`zoom.html`)

A kelp under the surface, the sun behind it and coming through its blades. It keeps growing towards the light
and the eye keeps closing in on its tip, and it never gets there. It loops every 16 seconds.

### How it loops (`src/plant.ts`)

The tip of the plant stands still, and everything else grows away from it: a part one blade older is 1.12 times
further from the tip and 1.12 times bigger (`GROW`). That is how a shoot really grows near its tip, and with the
eye held on the tip it is a zoom. Thirteen blades are born in a loop (`KEYS`), so in a loop everything gets
4.4 times bigger, and the tip is where it was: the same distance under the surface.

Nothing is simulated and nothing remembers anything. A blade is a function of three things only: how old it is,
which of thirteen characters it has (its number modulo 13), and where in the loop we are. After one loop blade
n + 13 is exactly what blade n was, so the last frame meets the first with nothing to settle. Blades go round the
stem by 137.5 degrees each; thirteen of them come 12.5 degrees short of five whole turns, so the plant turns on
by that much in a loop (`TURN`).

What changes with a blade's age: it starts rolled into a tube lying along the stem and curled in over the tip,
unrolls, stands out, and when old hangs. Its bladder swells. It turns about its own length to put its face to
the sun (`face`), which, the sun being behind the plant, is also what turns its bright side to the eye.

The water moves it: the whole plant leans with a swell, and each blade is bent, turned and twisted by waves that
start at its stalk and run out to its tip. The edge of a blade is longer than its middle, so it waves, and those
waves crawl outward too. Every one of these goes round a whole number of times in the loop.

About fifty blades are drawn, from one a hundredth of the picture to ones far below it. All of it is posed on the
CPU each frame (2 ms).

### The light (`src/light.ts`, `src/web.ts`, `src/look.ts`)

A blade lets light through and keeps some of it, more of the blue than the green and more of the green than the
red: one blade is gold, two are amber, three are brown. A shadow map that only says lit or not cannot show that.
So the plant is drawn from the sun four times, each time throwing away what the pass before already kept (depth
peeling). That gives, for every ray of sun, the first four things it meets: how far along each is and how much
it keeps. The light arriving anywhere is the sun less every layer met before there.

What reaches the eye from a blade is mostly what came through it: that, less the blade's own thickness, which is
its picture (a midrib, veins leaving it, blisters between the veins, darker patches, thicker with age).

The moving web of light on everything is the sun gathered by the waves on top: a sum of eleven sine waves whose
curvature says how much a patch of light has been squeezed by this depth. The waves fit their tile a whole number
of times and go round a whole number of times in the loop.

### The water (`src/water.ts`, `src/snow.ts`)

Water takes colour out of what is far, red first, and puts its own in. The shafts are the same web of light seen
from the side: each picture ray is walked in 28 steps, reading at each the web and the sun map, so a shaft is
dimmer and amber where a blade stands in it. Only the difference from even light is added, or the shafts would be
a white veil. They are made at half size (they are soft), which took the frame from 15.8 to 7.7 ms at 3200x2000.

Above is the underside of the surface: the web again, read twice at two sizes and turned so that no tile shows.

The snow belongs to the water, not to the plant. It sinks at a steady pace, past the tip which hardly moves and
alongside the lower blades which are leaving as fast; that is what says the plant is climbing. In a zoom it could
only pour out of the tip. It is one slab drawn again above itself, and sinks a whole number of slabs in a loop.

Then a lens focused on the tip (`src/lens.ts`, from day 16), glow, and grain.

## The other pages: a shape made of seaweed (`suzanne.html`, `venus.html`)

A shape as a clump of green seaweed on a stalk, weed all the way through, in a current, with the sun going slowly
from side to side over it: Blender's monkey head, and the Venus de Milo. Only the downstream fringe lets go into
streamers. Nothing grows or dies; the water moves it, in a loop of 24 seconds. Move the pointer over it and it
is a hand in the weed (drag to turn the eye).

Both pages are `src/sculpture.ts`; which shape is `data-shape` on the page's body, and what differs between them
(where it stands, how fine its weed is, where "downstream" begins, the eye) is the `pieces` table at the top of
that file. A shape is `{ position, index }` in `public/`, with half its height 1. `tools/shape.mjs` makes one
from a glb: the Venus is `03-melt/venus.glb`, 274 thousand triangles thinned to 21 thousand (0.5 MB).

**Where the weed is rooted (`src/grow.ts`)** is space colonization: the shape is filled with points, many just
under its skin and fewer inside, and branches are grown towards them from a stalk, each point pulling on the
branch node nearest it. That takes a third of a second at load. Of the tree it makes only the few thickest limbs
are drawn; the rest is there to say where a frond is rooted and which way the skin faces there.

**The fronds (`src/weed.ts`)** are ribbons posed in the vertex shader: on the monkey about ten thousand, six
under the skin and four inside; on the Venus thirteen thousand, shorter. Each has one number for how much it
belongs to the shape:

- 0: it is short, lies along the skin, and is lit mostly as the skin under it rather than as itself, so the sun
  shades a head and not thousands of leaves;
- 1: it is long, turns downstream within its first quarter and goes with the current, waving.

Those inside are in between: combed by the current, lit as themselves. The number rises towards the downstream
side of the head (`hold`, `gone`). The fronds on the skin lift together as the water's push passes over them and
lie down again (`breathe`), so the canopy opens and shuts and the light inside goes with it.

A small frond wants few triangles. The Venus' are 3 to 7 cm long, and at six quads by two each triangle was a
pixel or two across, which costs as much to draw as a big one: 29 ms a frame. At four quads by one, 10 ms.

**The sun through it (`src/deep.ts`)**. The zoom page's sun map knows the first four things a ray of sun meets,
which is no use where a ray meets forty. What is wanted is how much weed lies in front of every depth along
each ray: a deep shadow map (Lokovic and Veach 2000). It is kept here the way it is for hair, as a deep opacity
map (Yuksel and Keyser 2008): one pass draws how far along each ray the first frond is; two more add up, for
eight depths measured from that first frond, all that the weed in front of each keeps. The layers are 3 cm thick
at the surface and about twice as thick each time after, so the skin of the plant, which is what the eye sees,
is shaded frond by frond, and the inside is shaded smoothly. A frond adds a share to the layer it is in, so the
whole is smooth in depth, and takes its own share off again when it asks for its light, so it does not shade
itself. The weed has one tint, so one number is added per frond and the light left is the tint to the power of
it. Blades, limbs, the sand and the shafts in the water all read the same map.

Slices at fixed depths (opacity shadow maps) were the other plain way; they cannot tell a frond at the front of
a slice from those behind it in the same slice, which shows exactly on the surface. A Fourier series or moments
of the depth (as in moment-based transparency) need one pass and no layers, but ring where the weed begins
suddenly, which it does at the skin.

The pointer is a hand in the weed (`touch` in `src/weed.ts`): a ball on the pointer's line, at the first weed
that line comes to. Each frond is one body under it. A frond within reach wants its tip away from the ball and
along with the way the ball is moving, and goes there as a spring in water does, the long ones slowly; when the
hand has gone it swings back a little past where it was. All that is kept of a frond is how far its tip has been
pushed, and its vertex shader bends it by that from root to tip, the same on both edges and shortened by as much
as the push would lengthen it, so a pushed frond turns and bows and is no wider or longer than it was. (Pushing
each vertex by where it is, as this did at first, pulled a frond's two edges apart.) Thirteen thousand springs
take 0.7 ms a frame, and nothing at all once they have come to rest.

`?seed=7` grows another; on the monkey `?weed={"hold":-1.2,"gone":-0.9}` lets all of it go,
`{"hold":0.24,"gone":0.9}` half of it, `{"limb":0.003}` shows more of the branches. On the panel: `sunAzimuth` 152 puts the sun behind it,
`sunSway` 0 holds it still, `apart` is the first layer's thickness, `grown` runs the growth clock by hand.

## Weed that keeps growing (the page: `index.html`, `src/tangle.ts`)

Day 4's composition, and the body is the seaweed of the shapes: a dense mass up the picture's diagonal, its front
ragged, the eye going with it, 12 seconds a loop. The light is the shapes' too (`src/deep.ts`), and nothing is
simulated. (It began as a bundle of winding stipes that drew in behind the front, which was day 4's ropes
tightening over again; now nothing winds and nothing draws in.)

`src/stems.ts` draws everything in the frame that travels with the growth, where the front stays about the origin
and the body streams back from it:

- The body is a lumpy tube about a wandering spine, fixed in the plant and repeating once a loop of growth. Its
  lumps stand where they are (so many round the body times so many along it). A lump that goes round as it goes
  along is a strand of rope, and the first try at this looked like one.
- Once a loop the tube goes through a rounded cube, from corner to corner (an experiment; `cube` 0 for none).
  Set so, no face of the cube is square to the tube, so the skin is still one distance from the spine for each
  way round and place along. That distance is baked into a small texture (256 round by 512 along, with its
  slopes for the skin's outward) which the vertex shader reads; the cube is found in it by bisection along each
  ray from the spine. Or it goes through the monkey (`put` on the panel, or `?put=suzanne`, `both`, `none`):
  any closed mesh can be baked, stood upright in the picture with the tube through it on the slant, a slice of
  the loop at a time (each triangle cut by the slice into a line, and that line seen from the spine; the skin
  is the furthest of it each way, so a hollow the spine cannot see is filled). The baked map shows her eyes,
  muzzle and ears plainly; under fronds of this size she is a head-shaped mass with an ear and a brow, and
  reads better with all the shoots and fronds there are, at 0.65 of their size. She comes out of the tube softly (`blend`): where the two skins cross they are run together, and where she stands straight out of it (under the chin) the tube swells towards her. Where there is more skin there are more fronds: along the loop by where they are put, and
  round the body, where the shoots cannot be moved, by making a frond far out bigger.
- A shoot is a thin stipe the length of the body, 70% of them in its skin and the rest inside, each with a small
  wander of its own. They are what is seen to grow at the front; behind it the fronds hide them. Its rings are
  at places on the plant (48 a loop) and stay there; only the first is the head. Rings that kept their distance
  from the head slid along the skin as it went on, and over a figure, whose skin is not smooth, the shoot cut
  each corner differently every frame: a tremor. The shoots inside the body are put by a skin with nothing small
  in it (the least of the real one round about, then smoothed), or each would have half an ear in it.
- A head is where its shoot has got to: the loop's phase plus things that repeat every loop, so each covers one
  pitch a loop. The front goes on a part at a time (`surge`): the body is cut round into five big uneven
  parts and eleven small, and a part has its own time to go, once a loop for the big and twice for the small,
  and each shoot three goings of its own. A going is a head standing nearly still for 60% of the time while the
  eye goes on, and making it all up in the rest; day 4's ease, which was here before, spends the same slowing
  on half as much being left behind. So parts are left behind by most of the body's width and come on through
  the others. The whole front has two gentle surges besides (`gust`). How nearly each thing stops a head adds
  up to under 1 at the panel's most, so no head goes back.
- A frond of the skin is short, lies along the skin and is lit mostly as the skin (`smooth`), so the fronds
  together show the body's lumps and not their own faces; the skin's outward is the tube's, written down, not
  measured. Round on the side the current leaves by they let go into streamers, raggedly. Inside is weed too.
- A frond's age is how long it has lived, not how far behind its head it is (a head that surged on used to
  swell every frond behind it), with half of what the head has gained since counted as time too, or a part that
  rushed on would leave a long bare shoot. The moment the head was at its place is found by halving. Not in the
  vertex shader, where it began: a head is at a frond's place at the same moment of every loop, so that
  moment is one number a frond, found once on the CPU (and again when `surge` or `gust` change). It is as
  wide as it will be long before it is as long, so a young streamer is a short frond and not a hair.
- A frond has a place in the loop and a lap. When the head passes its place again, the frond that was there is
  drawn by the next lap's slot; so a loop on, the same picture has moved one pitch, and so has the eye. The
  marine snow goes back past the eye the other way, which is what says it is moving.

Something happens in it, once a loop (twice with both things in):

- The thing the tube goes through is there itself, as rock (`src/rock.ts`): it hangs in the water ahead of the
  front, comes down the diagonal as the eye goes up it, and the front reaches it, runs over it and takes it. The
  rock is 0.86 of the skin the fronds lie on, so the shoots are seen to run over stone; it rides the water's
  push as the weed does, or it would come through its coat on one side. The cube is a grid brought in to a
  rounded cube and dented; the monkey is her mesh, weathered a little. Four of each are drawn, a loop apart.
- A rock lets no light through, and is not in the sun map's layers: a layer cannot tell what is just in front of
  a thing in it from what is just behind, so a frond on the sunny side of the rock would be as dark as its far
  side. It has a map of its own (`solids` in `src/deep.ts`): how far along each ray the rock is, and what is
  behind that is dark. So the rock shadows the weed and the shafts, the weed shadows the rock, and the sun's web
  lies on the stone.
- Fish (`src/fish.ts`), forty of them, keep up with the growth on the body's shaded side, where they are dark,
  a little way out from the skin as it goes by. They are two models from Sketchfab, a clownfish and a copperband
  butterflyfish (`?fish=clown`, `butterfly`, `both`, or `drawn` for the one of rings that was here first);
  the butterflyfish has no bones, so its swimming is done to its points; the clownfish came with bones and a clip
  of itself swimming, which is played once as the page loads and kept as a picture, a point wide and a moment
  high (bones cannot be drawn forty at once, each at its own moment; a picture can be read). A beat of the tail
  is then once through half that clip, at the fish's own pace, more or less of it as it swims harder or glides. As a rock comes down, those that live near the front
  go out to meet it, the nearest first and the rest after them, and go slowly round it in the sun, where they
  are bright. When the weed touches the rock they bolt home; those further down the body take fright as these
  arrive, the further the later; then all keep close in among the fronds for a while. With two rocks, half the
  fish are for each. Twice a loop besides, one starts at nothing and those near it dart away.
- None of that is simulated. Where a fish is, is written down as a thing of the loop's phase that comes round
  every loop: a home, wanders of whole numbers of turns, a share of the way to the rock that rises and falls,
  darts.
- What makes it water and not arrows. A way out to the rock takes 0.4 of the loop and a way home 0.17 (at first
  they were 0.14 and 0.045: fifteen lengths a second, which no fish that size does). Nothing goes straight or
  stops at once: out is an arc round the front and a long arriving, home is off quickly and then mostly glide,
  by another arc. A fish faces the way it is going through the water (which goes back past this frame at the
  speed of the growth, so one at rest faces up the diagonal), taken over a quarter of a second, so that it comes
  round and does not flip; and it bends as it turns, nose and tail both to the inside, since a body lies along
  its path. Its tail beats as it must: so many beats to a length swum (the errands add whole numbers of beats,
  or the loop would not close), wide when it gathers speed and hardly at all when it glides. A fish at the rock
  goes round it one way and does not rock to and fro, or it would turn about at each end.
  `tools/trails.mjs` shows all this in one picture: many moments laid over each other, so that each fish is a
  row of itself, spaced as it is fast.
- A fish that is hardly moving in the water has no way it is going, and the least thing would spin it. So it
  has a way it likes to face, into the water coming at it (up the growth), added as a third of the growth's
  speed; and none stands on its head or tail. The butterflyfish is a plate and not a ribbon: it takes fewer
  beats and hardly bends (`Swim` in `src/fish.ts`).
- The models came with photographs for paint, and a photograph has its light in it: the clownfish was dark
  underneath, the butterflyfish violet from an aquarium's lamp, and both were wrong as soon as they were lit
  again. `tools/repaint.mjs` makes each its own paint from its photograph: every texel is sorted by its colour,
  not its brightness, into what it is (orange, white, black; silver, band, black) and painted that; what is
  kept of the photograph is its grain, its brightness over its brightness blurred among its own kind. Alpha is
  how silvery the texel is, and there a film of colours plays (`sheen`): a colour that goes round with the
  angle the skin is seen at and the sun's, as mother of pearl does.
- A fish's place is kept as how far along the growth, how far round it and how far out, and a way from one
  place to another is each of those going its own way: so it goes round the body and not through it. How far
  out is never less than what is there (the weed's skin and a tenth for its fronds, where it has grown to; a
  rock, which is the skin's own shape at its place, ending before and behind) and a clear space besides. Before
  this a way was a straight line from a place in space to another, bent a little, and a fish that went through
  the weed or the stone was seen to vanish and come back somewhere else.
- What a fish keeps clear of is not the skin itself but the skin with nothing sudden in it (`bulkAt` in
  `src/stems.ts`: the most of the skin round about, then smoothed over no more than that, so never inside
  it), and a rock's ends come on gently. The monkey's chin is a cliff in the real skin, and a fish keeping its
  distance from a cliff was thrown out and let back as the chin went by. `tools/frames.mjs` lays a small
  part of the picture out at moments that follow each other, for such things.
- A small fish is lit all round and is not half so dark on its far side as a stone is (`bright in the sun`):
  in this picture, with the sun behind everything, the first fish were dull where they should be the bright
  things.
- A fish takes the sun's light over a patch its own size, eleven reads of the sun map and not one. The edge of
  a frond's shadow, or the rock's, crosses a fish in two frames, and on a pale fish that was a flicker (it was
  taken for a jitter of the fish; `tools/jumps.mjs` found nothing that jumped).
- The eye is further up the body than it was (`back` 0.25), so that the rock is seen coming.

The sun's web stays where it is in the water, so in this frame it goes back past the eye at the speed of the
growth, with the body it falls on (`drift` in `src/web.ts`; left still, the body slid along under a pattern
that did not). For the loop to close, a loop's travel has to be a whole number of the web's tiles: the tile is
laid along the body as the sun sees it, and its size is the nearest to `webSize` that fits (the shafts' tile
likewise). The rippled surface overhead is not moved.

Three hundred shoots and 58,000 fronds, posed in the vertex shader. What that costs is vertices and sun-map
texels, not pixels of the picture:

- everything a frond works out about itself is worked out again at each of its vertices, so a short frond is
  5 by 2 quads, and in the sun map (drawn three times, a frond a few texels) 3 by 1, off the same buffer;
- the sun map's fronds keep a plain share of the light: veins there are smaller than a texel, and were a noise
  for every texel of every frond. The age a frond is coloured by is found once a vertex, not once a pixel;
- only the fronds that are shown are in the buffer.

What a frame costs was measured by stopping the picture at each stage (`?only=scene`, `water`, `lens`, `snow`)
and by switching parts off (`tools/cost.mjs`), at 3200x2000 on an M1 Max. Two things about measuring: the
first seconds after a page loads read too fast (frames are handed over faster than the GPU finishes them, so
`cost.mjs` warms up first), and above 8 ms the readings snap to the display's pacing (72, 60, 48 frames a
second), so only differences of a millisecond or more mean anything. GPU timestamp queries were no use: passes
overlap on this GPU and their times add up to ten frames' worth.

| | ms a frame |
|---|---|
| as it was | 14.3 |
| shafts at 0.34 of the picture's size and 16 steps (were 0.5 and 28) | -3 |
| lens of 18 taps (was 32) | -1.5 |
| a frond's birth found on the CPU | -0.5 |
| now | about 10 |

The old and new shafts and lens differ by 0.1% of the picture. Of what is left: the water, lens, snow and glow
about 4.5 ms, the fronds in the picture about 2, the sun map about 2 (half of that is there with nothing in it;
making the map smaller gains nothing, it is bound by vertices and by its passes), the rest the shoots and the
4x antialiasing (1.2). `?steps=`, `?shaft=`, `?taps=`, `?samples=` and `?sun=` set those for trying.

How dense it is is on the panel (`density`): how many shoots, how many fronds a loop on each, and how big a
frond. It is built once for the most of each (420 shoots, 150 fronds a loop); both are dealt out so that any
number of them is spread evenly, the buffer is packed again when the number changes, and the last frond let in
is part grown, so dragging does not pop.

`?stems={"count":140,"perLoop":60,"wide":0.4,"seed":4}` sets any of `stems.ts`' numbers (`count` and `perLoop`
are what the panel starts at; `flow` is the current, `hold`, `gone` and `tail` the streamers; `cubeAt` and
`cubeRoll` are where in the loop the cube is and how it is turned). The body's shape (`wide`, `lumps`, `bends`,
the cube) is baked again when its sliders are let go.

## Tools

```sh
node tools/shot.mjs out.png 1280x800 0.1 0.6     # the page at those moments of the loop, side by side
SET='{"sun":3}' node tools/shot.mjs out.png      # with panel values changed
node tools/seam.mjs                              # frames 1/960 of a loop apart, across the seam and elsewhere
node tools/perf.mjs 1600x1000 2                  # frames a second at a real size, and without each part
node tools/cost.mjs 1600x1000 2 '{}' '{"stipes":420}'   # ms a frame for each set of panel values
node tools/series.mjs 800x500 1 6                # ms a frame through the first seconds
node tools/film.mjs output/kelp_x.mp4 1024x1024  # the loop as a film, frame by frame (DPR=2 CRF=16 for the one that is published)
node tools/trails.mjs out.png 1600x1000 0.3 0.5 21   # what moves, as trails; tools/frames.mjs for moments side by side
URL=http://localhost:5317/suzanne.html node tools/shot.mjs out.png 960x640 0.2 0.5 0.9   # any of them on another page (zoom.html, venus.html)
node --experimental-strip-types tools/grow.mjs '{"step":0.014}'   # grow the monkey outside the browser, and count (SHAPE=venus for her)
node tools/shape.mjs ../03-melt/venus.glb public/venus.json 0.02  # a shape for the weed out of a glb
```

Measured, the zoom: frames a whole loop apart differ by 0.007 of 255; the step across the seam (1.12) is like the steps
elsewhere (1.03 to 1.18). 110 frames a second at 3200x2000 on the Mac.

The shapes: frames a whole loop apart differ by 0.002 of 255; the monkey 94 and the Venus 99 frames a second at 3200x2000.

## The fish

Both are from Sketchfab and are in `public/` as they came. **Their licences differ: the clownfish is CC-BY-NC 4.0,
not for commercial use**; the butterflyfish is CC-BY 4.0. `butterflyfish.png` beside them is the paint made from
its photograph (`node tools/repaint.mjs butterfly public/butterflyfish.glb public/butterflyfish.png`); the
clownfish wears its own.

- `clownfish.glb`: "Clownfish" by ernielo18, https://sketchfab.com/3d-models/clownfish-fd393e0b695842629bc8e861d6499c09
  (the first clownfish here was "Fish" by chenyu0930, CC-BY 4.0, a photograph on a shell)
- `butterflyfish.glb`: "Small fish" by The SpezX, https://sketchfab.com/3d-models/small-fish-8f5de32946f347a0b6c8e55c6a66d46d

## Quicker

Two things in the panel's picture folder, both on to begin with: `resolution` 0.8 (fewer pixels than the
screen has; 0.75 was a fifth to a third quicker) and `sun map every other frame` (shadows a frame late; a tenth
to a third). Neither is used when a moment is held (`state.hold`, as the tools do) or when ssam says it is
recording: then the picture is whole. That switch to whole while ssam records has not been tried; if a
recording comes out the wrong size, set `resolution` to 1 first.

## While it loads

The page says `kelping` till its first picture is on the screen: each letter is the top of a stipe that sways
from its foot, the next a little after the last, as a swell goes along a bed of weed. It is in `index.html`
itself, markup and CSS, so it is there before any script is.

- Most of the wait (up to four seconds the first time, next to nothing after) is the first frame, which has
  every shader to build and holds the page's thread while it does. So nothing in the loader is driven by a
  script: only `transform` and `opacity` are animated, on HTML elements, which the browser goes on moving by
  itself. (Held in a loop for 2.5 s, the page still gave 126 different frames of it.)
- It goes when the card has drawn the first four frames (`device.queue.onSubmittedWorkDone()`), not when they
  were asked for, and fades into the picture already moving under it.
- Without WebGPU, or if something throws before the picture comes, it says so and does not sway for ever.
