# 12-feather

Six great egrets (чапля велика біла, _Ardea alba_), the white heron of the Dnipro at Kyiv, skimming a
mirror sea in a loose V under an anime sun, with cumulus standing on the horizon. The birds are drawn as a
hand-painted cel: a flat pale fill, a dark contour round each bird (its colour, and a second one for over cloud, can be changed) and a few ink dashes
for feathers. Grain, colours printed out of register and a vignette are there to be turned up (`grain`, `fringe`, `vignette`) but are off: the picture is clean. The sea shows them and the sky
again, cut into sliding bands by the swell.

The loop is 12 s, and the flock is a steady stream in which nothing waits for anything else. A bird joins
at the back of an arm, slides up it at an even pace, quickens as it nears the point, rounds it, and flies
off ahead until it is lost in the sun's glare; four seconds behind it comes the next on the same arm, and
two seconds behind it the next on the other arm, so they pass the point by turns. Every one of them began
as a feather that slipped from under a bird in the formation (from under its wing if the wing is down just then, from under its body at the wing's root if it is up, so that none appears over a bird), drops clear of it at once, life size and broad side on,
shaft and barbs showing, grows as it falls towards the viewer, turns flat, swings to and fro twice, and turns out to be a far-off egret gliding
head-on, which starts to beat the moment the feather has thinned away (`wakes` in the story folder). That bird sways and flies in on a curve, nose first and leaning into the turn, to
the back of its arm. The feathers go two seconds apart and each takes 11.4 s, so five or six are always
under way, two or three of them still feathers. A bird's life (feather, up the arm, round the point, gone)
is longer than the loop, so each is lived by several birds at once, twelve seconds apart, and at the end of
the loop each has become exactly what the next was at its start.

The camera stands half a metre over the water and looks up, so the horizon is low: a strip of sea, and the
sky for the flock. The V is rolled towards the viewer (`bank`), so that from the side it opens out over the sky
instead of lying in a line. `framing` in the panel's camera folder switches to the other framings that were
tried (`FRAMINGS` in `src/index.ts`: where the camera stands and looks, with the sun and `bank` that suit it);
`level` is the first one, horizon across the middle.

The birds are not quite great egrets any more: pale grey wings (`wing`) with charcoal flight feathers (`pale`), an
ivory body (`fill`) that turns pale blue where it faces down (`under`), and a dark streak over the eye running
back into a short plume (`cap`), as on a grey heron. Afterwards, on the flat picture:

- the contour is thin and dark navy, whole underneath a bird and let go to `edgeLight` of itself along an
  edge that faces the sun and the sky;
- plumage within `rim` of open sky in the sun's direction is left white: the one bright edge (a loose feather
  gets only `rimFeather` of that width, having a part id of its own, `PART.loose`);
- a bird far off goes towards `hazeTone` and its line thins (`haze`, from `hazeFrom` to `hazeTo` metres);
- `nearer` draws the near end of the V larger than life and the far end smaller, for more depth than there is
  (a bird joining is life size while it has to match its feather, and takes its place's size on the way in).

The painting is turned (`paintTurn`) so that its tall cloud stands to the left and the flock crosses open blue.

Underneath, each bird is made of separate feathers (about 540 on the wings and tail, re-posed each frame,
and 1100 on the body); the drawing is made from those.

## The painted sky

The clouds are a painting, `public/sky.png` (generated from a prompt; `.jpg` and `.webp` are looked for
too). It is hung round the horizon behind the flock and mirrored in the sea with everything else. Without
it the clouds are made in the shader, crudely.

- `skies/` keeps the paintings tried so far (`sky-1.png`, `sky-2.png`; the second is the one in `public/`). Only
  `public/sky.png` ships. To switch, copy one over it.
- Sky only: the bottom edge of the image is the horizon. No water, no sun (the page draws its own, upper right).
- Landscape 2:1; the present one is 1774 px wide, and a larger one would be sharper on a big screen.
- `paintWide` (sky folder) is how many degrees of horizon it spans: larger makes its clouds larger. The frame
  is about 52 degrees wide, and where the image runs out sideways it is mirrored, so below about 54 the
  mirrored edge shows as a symmetrical cloud. `paintTurn` slides it sideways.

The sun can be a painting too: `public/sun.png` (or `.jpg`, `.webp`), a square of light on pure black with the
sun in the middle and its rays fading out before the border. It is added to the sky as light where the sun is
(`sunRight`, `sunUp`), `sunWide` degrees across, and rocks and breathes a little (`sunRock`, `sunBreath`), since
a painted sun is not alike all the way round and cannot turn for ever. Without it the sun is drawn in the shader. `suns/`
keeps the ones tried (`sun-1.png` is the one in `public/`).

Two earlier takes of the same bird are kept as their own pages, each a frozen copy of the source:
`paint.html` (`src/paint`: painted anime background look, lit feathers that glow where the sun comes
through, cumulus, river plain) and `real.html` (`src/real`: realistic light, fully feathered neck).

The wings flex because the stroke is a wave: upper arm, forearm, hand and feather tips all follow the same
swing, each later than the one before. On the way down the tips trail above and the air bends the primaries
up; on the way up the wrist leads, the hand hangs, and the primaries turn like blinds to let air through.
All of it is a function of the beat phase, so a whole number of beats closes exactly.

The beat runs down the V as a wave: each bird is `wave` of a beat behind the one ahead of it, counted from
the point, so a crest travels back along both arms. Each bird also stops beating once a loop and rides the air
for a few seconds: the wings are held spread in a shallow V with the tips bent up and the fingers apart, a slow
swell runs along them, and the body sinks a little and leans from side to side. The beats fade out into the
glide and back in. The glide goes down the V too, slowly (`still` of the loop from one bird to the next), as a
patch of stillness about two birds long. `ragged` is how much each bird keeps to a time of its own instead
(`wave` 0, `ragged` 1: every bird to itself, as it was).

- `src/heron.ts`: the bird. Body, a slim bare S of neck, bill and legs are tubes through control points.
  The wing is three bones with a flat lens of skin, and a list of feathers placed along it (primaries,
  secondaries, tertials, coverts over and under in rows, alula, scapulars). `motion` holds the flight;
  `update(phase)` poses it. Shoulder feathers have `hold`, which keeps them to the body's level while
  their roots ride the arm. Every part carries an id (`PART`) for the inking.
- `src/feather.ts`: one feather. The vertex stage gives it an outline (quill, vane, rounded or fingered
  tip), an arch across, a bend, sweep and twist along the shaft. The fragment stage paints the fill, a paler
  tip on flight feathers, and on some feathers an ink dash along part of the edge.
- `src/shade.ts`: the cel's colours and the part ids.
- `src/shed.ts`: the loose feathers. Not taken from the birds, which keep all of theirs. Each has a moment
  in the loop when it is let go (from where that wing is at that moment) and a life shorter than the loop;
  its place depends only on its age, so nothing is simulated and the loop closes. It slides side to side
  as `sin`, rises at each end as `sin²`, and banks with the outer edge up. `fall` holds the settings.
- `src/story.ts`: the feather that is a bird. A feather near by and a bird far off on the same line of sight
  are the same size on screen; a curved feather from the side and a bird gliding at you are both an arc; a
  feather sliding along its length with the leading end tipped up is a bird banking. So a real bird is put
  far behind the feather on the camera's ray, head-on, tipped and swaying as the feather is; the feather
  thins to a line and is gone at `wakes`, and only then does the bird begin to beat (sooner, and a wing lifting off the feather's line is seen double); the bird flies in along the ray (`far` times the distance down to 1), its place
  on screen bending from the feather's path to its place in the V. The feather drifts towards the viewer as
  it falls (`toward`) so the change is large enough to see. `tell(k, tau, ...)` is a function of the time
  since feather k was let go and of the camera, so it holds from any angle.
- `src/index.ts`: the stage and the flock. `PLACES` are the six places in the V on one line (-1 the short
  arm, 0 the point, 1..4 the long arm); where a bird is, its size, where in its beat it is and when it
  glides all belong to the place, and a bird moving up takes on the next place's by degrees. `FEATHERS` (when each is let
  go, which place's bird lets it go and which arm its bird joins) is the schedule. Only the three birds on the long arm are
  ever settled in a place, and a bird moves up one place in four seconds, so places 3 and 1 are asked by turns: each of
  those birds lets go two feathers, six seconds apart (asking 3, 2, 2, ... made one bird shed four running), and `EVERY` is the pace; `fly(bird, t)` poses one from its
  age alone: up the arm on a smooth line through the places, round the point, and away along `run(r)`. The picture is drawn with a second sheet beside it (is this bird, which part, how far).
  Afterwards a contour is laid outside the birds within a brush width, and likewise round any part that
  passes in front of another with a real gap in depth. The lines stray a little each time they are
  "redrawn" (`boil`). Then the sun's glare over everything (and fringing, grain and vignette, if turned up).
- `src/sky.ts`: deep blue sky, the sun (disc, two flat rings, twelve rays, long and short by turns, that turn a sixth of a turn per
  loop), and the cumulus: the painting if there is one, otherwise made once into a panorama as "how far
  inside" plus a light value and cut into three flat tones at draw time. The clouds stand still.
- `src/water.ts`: the sea. The scene is drawn a second time from where the camera's reflection would stand
  under the surface (a pass set up like the main one, since the birds' materials write two sheets), and the
  water shows that picture slipped sideways in strips by noise that slides back along the line of flight.
  Over it are painted dashes of light and of shadow (`seaDashes`), in six sizes, each used only at the distance
  where it is a few pixels deep; under the sun they crowd and take its colour (`glitter`). The eye is so low
  that a level dash on screen is, on the water, much deeper than it is wide. `seaHaze` pales the far sea.
  From this low, flat water would show only the sky just over the horizon: the birds' images lie below the
  bottom of the frame. So in the sea's picture, and only there, each bird is brought straight down to fly just
  over the water (`lowered` in `src/shade.ts`, a vertex stage that knows the sea's picture by its camera being
  under the water), and the sea shows it whole, under where it really is. `seaBirds` is how far they are
  brought down (0: not at all, which is the true reflection), `seaSkim` and `seaKeep` the height they come to.
  Eleven birds are in the air at once and the strip of sea is thin, so there they are also drawn smaller
  (`seaBirdsSize`, of their size) and only those within `seaBirdsFar` metres of the eye (the V is 10 to 17 m
  off, those coming and going up to 33; one dwindles over the last 2 m). `seaBirdsDim` sinks them into the
  sea's colour, which the sea does by reading where its picture is bird from the second sheet.
- `tools/shot.mjs out.png 900x600 "0.03@40,-20,3" "0.3"`: headless shots tiled into one sheet; each is
  `playhead@azimuth,elevation,distance[,target xyz]`, or just a playhead for the drifting camera
  (SET, MOTION, EVAL, DPR, COLS). Dev server on 5312: `npx vite --port 5312`.
- `tools/strip.mjs out.png 0 4.2 5.4 16`: close-ups of feather 0's bird from 4.2 to 5.4 s after the feather is let
  go, 16 of them in a row: the way to look at the moment a feather turns out to be a bird.
- `tools/film.mjs outdir 1000x750 0 720`: consecutive 60 fps frames and an mp4 (VIEW, CLIP, EVERY, SET).
  `magick outdir/f*.png -evaluate-sequence max strobe.png` overlays them: the way to see a path in a still.
