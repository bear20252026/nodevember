# 15-mirage

A flight over a desert at dusk toward an oasis that is never reached. Mirrors stand in the sand. The arched
ones are not mirrors but doors, each of them back to where the flight began, so the oasis seen in a door is
the same oasis a little further off. The eye goes through one door after another, a different one each lap,
and three laps make a seamless loop.

```sh
portless            # https://mirage.localhost
npm run dev         # or a numbered port (the tools expect 5315: npx vite --port 5315)
```

The page is the garden: 180 m a loop, three doors within 70 m of the start, an avenue of mirrors along each way
(the eye is within 5 m of one three quarters of the time), small dunes underfoot and boulders among them.
Dragging turns the eye to look about as it flies (up to 65 degrees either side, 25 up, 18 down: `lookWide`,
`lookUp`, `lookDown`), and let go it comes back to the way (`lookBack`).

The first take, the long flight (420 m a loop down a wide flat lane, mirrors far apart), is still in the program
as `<body data-scene="far">`; it was `index.html` until the garden (once `garden.html`) took its place. Much of
what follows was worked out on it, and its numbers are given beside the garden's.

## How it works

The whole picture is one ray a pixel, followed from thing to thing (`src/trace.wgsl`):

- a ray that meets a **mirror** goes on reflected;
- one that meets a **door** goes on from the world's start, turned the way the door is turned;
- one that meets flat hot sand at a shallow enough angle goes on as if the sand were water: the **mirage**,
  which is why there is always water a hundred metres ahead and never any underfoot;
- whatever it ends on (sand, sky, palms) is the pixel, through the air it crossed.

Because the picture is nothing but a function of the ray, the view into a door from just before it is the view
from just inside it. Flying through is seamless without anything being done about it, and so is the loop.
`world.ts` builds the laps so that the way is dead straight and level for the last and first stretch of each
(16 m on the long flight, 10 m in the garden), which makes the eye's motion as smooth across a door as anywhere
else. Between the straights the way is a quintic through the points, given at each the way and the bend it is
to have, none at the straights: a Catmull-Rom curve, as it first was, swung across a straight and back where
it met it, which was the eye swaying right before each door. (The mirrors and boulders are still set out by
the first ways, so they stand where they did.) `tools/camera.mjs` measures how smoothly the eye turns.

The same tracing gives things a rasteriser would not: every mirror throws a patch of sun on the sand, and every
door lets the sun through from the world it leads to, where the sun stands another way round.

### Ground

Dunes are not a stored height map. Only the slow things are kept as pictures (`fields.wgsl` makes them, 2 m to
a texel, repeating every 4 km): how far the crests are pushed along the wind, the lie of the land, how tall the
dunes are, where each one's brink is. The dune itself, a long windward back and a slip face at the angle of
repose, is worked out on top (`ground.wgsl`), so its brink is sharp at any distance. Pads level the ground for
the lane, the start, the doors and the oasis.

Between the big dunes there can be small ones (`smallTall` and the sliders after it; the garden has them): a
second, closer wave with its own heading, standing only where the big dunes are low and the sand has not been
levelled, taller in patches. They run nearly along the sun's way on purpose: at 3.5 degrees a 2 m ridge across
the light would shade 30 m.

`reach.wgsl` finds where a ray meets it. A pyramid of "the highest ground in this square" lets a ray pass whole
squares at once; in the smallest squares the steepest slope there bounds how far it may safely step.

### Boulders

Each is a ball cut by sixteen flat faces (`boulder` in `world.ts`), so a ray meets it by plain arithmetic: no
marching. Near an edge the faces' directions are blended, which wears the edges round; sand is banked against
the foot and lies on what looks up. They shade the sand and each other, and show in the mirrors.

### Not asking

Every pixel used to ask every glass, three times over (is it in the ray's way, does it shade this sand, does it
throw the sun on it), and that was half the frame, reflections or no. Now:

- a ray from the eye is told which glasses and boulders its part of the screen can show (`tile` in `index.ts`:
  16 x 10 tiles, a bit an object, worked out each frame from balls round them);
- whatever a glass shades lies in a stripe behind it along the sun's way, so how far a point is across that way
  (one number) rules most glasses out with a comparison; the same for the sun each mirror throws, and for
  boulders;
- a ray off a mirror or through a door is told what it can meet (`reflections` in `index.ts`, `Lists` in
  `trace.wgsl`). All that a mirror shows is what an eye would see through it from the eye's image in it, and
  all that a door shows, what an eye would see through it from where the door takes the eye: so each frame
  every glass gets the balls in that view. Off a second glass the eye is no help, and the ray is told what is
  on its side of that glass. (A door's rim is steel, and sends the ray back instead of through it: those rays,
  a few pixels, are told nothing and ask everything.)

All of it only leaves out what could not have mattered: the picture is the same, to within 1/100 in at most a
pixel or two of a frame, and the trace a good third quicker. Finding that it was so took a check that rays
through every glass meet nothing their list leaves out (it found the rim).

### Light baked once

The sun never moves, and neither does anything it falls on, so the light on the ground does not hang on where
the eye is. Two things are worked out once when the page opens, a few frames' worth of work, and read back:

- for the ground about the glasses (`lightBake` in `trace.wgsl`, about 3,000 x 7,000 texels of 4 cm in the
  garden, 9 cm on the long flight): how much of the sun gets past the dunes, the glasses and the boulders, and
  how much of the sky the boulders leave;
- for every glass (`glassBake`, 32 x 128 texels each): how much of the sun gets to each place on it, which is
  what was dear in the light a mirror throws.

Not baked: the light the mirrors throw on the ground itself. On rippled sand it hangs on the way each ripple
faces each mirror that lights it, and a texel would have to keep the way of every one; kept for two, a seam
showed wherever a third began. So it is worked out where it falls, which is cheap once the sun on the glass
is known. Baked and worked out afresh differ by less than 2/10,000 on average. `baked` in the panel turns it
off, `bakeTexels` sets how fine it is, and outside the baked ground everything is worked out as before.

What it and what followed saved, GPU time a frame on the laptop's screen (`tools/bench.mjs`, mean of five
moments):

|                                                    | garden  | long flight |
| -------------------------------------------------- | ------- | ----------- |
| worked out afresh                                  | 17.5 ms | 15.7 ms     |
| the light baked                                    | 13.6 ms | 13.7 ms     |
| and rays off glass told what they can meet         | 12.9 ms | 13.7 ms     |
| and fewer rays for edges (garden 1, long flight 2) | 11.1 ms | 10.8 ms     |

### Sky

Made once (`sky.wgsl`) into a picture of the dome: sunlight scattered through an atmosphere like the earth's,
then two decks of cloud marched through a block of noise (`grain.wgsl`) and lit from where the sun is. The same
pass gives the light the sky sheds on a face. The clouds get their sun a few degrees lower than the sand does
(`cloudTilt`), so they are lit from under.

### Rims

A glass's rim is dark metal (`rimDark`; 0 gives the old polished steel, a dim mirror): flat where it meets the
glass and rounded over to its outer edge, so that somewhere across it it faces the way that sends the sun to
the eye, and shows a thin glint and little else. Glasses are 2.5 cm thick (`rimDepth`): seen edge on, the side
shows, as a rim as wide as the side looks, and an edge-on mirror is a dark line instead of a dashed one.

A dark line against a bright sky shows every ray that misses it, and far off a rim is narrower than a pixel. So
it is not left to the rays that happen to meet it: each ray stands for a pixel's width across the rim, and
takes as much rim as that width has (the rest is the glass beneath, or for a ray just outside the glass, what
is behind it), lit as the mean over the part it takes in. A thin rim is then a faint line a pixel wide that
does not break up as it moves, and the glint along it, far narrower still, a steady thread instead of specks.

### Pace

At most `fpsCap` frames a second (60): a screen that asks for 120 gets every other one, which looks steadier than
70 to 90 that come now one refresh late and now two. While frames still come late, fewer pixels are traced
(`adapt`): cut back within half a second, let up again a tenth at a time, and not for half a minute to where
they last came late. A film, a held moment and the tools always get the full `detail`.

### Edges

A ray that passes within 0.8 of a pixel of an edge marks its pixel, and marked pixels get two more rays (one in
the garden, where there is three times as much edge on screen: `edgeRays`, `edgeWide`). Those are
traced in a compute pass over a list of the marked pixels, not in the pixel's own shader: there it made the
whole frame three times slower, though one pixel in fifty is marked, because a batch of pixels takes as long as
its slowest one.

## Controls

The panel (top right) has everything: sun and air, clouds, dunes, sand, mirage, glass and oasis, eye, picture.
`view: map` shows the plan with the laps and glasses drawn on it, `view: sky` the sky picture. `edges: 2` shows
the marked pixels, `3` what each pixel cost.

## Tools

- `node tools/shot.mjs out.png 1280x720 0 0.3 ...`: the page headless at those moments of the loop, tiled.
  `SET='{"sunHigh":8}'` changes look values.
- `node tools/cost.mjs 1728x1000 0 0.5` (`DPR=2`): frames a second, and GPU time of the trace. The GPU time is
  only to be trusted when the GPU is busy: a light frame is run at a low clock and reads several times too long.
  Frames a second stop at 60, so to compare two ways of doing a thing raise `detail` until neither reaches it.
  (On battery the laptop shows 30 whatever is drawn.)
- `node tools/bench.mjs 1728x1080`: GPU milliseconds a frame, at five moments, for each way of setting it up in
  `RUNS` (`'[{"baked":false},{"baked":true}]'` by default; `"whole":false` times the trace alone). Sixty frames
  are given to the GPU at once and timed until done: unlike `cost.mjs` it is not held to 60 a second, and the
  GPU is busy enough to run at its full clock.
- `node tools/seam.mjs`: the page just before and just after each door, against an ordinary step of the same
  size. The two numbers of a pair should be alike. It turns the grain off: the grain's pattern changes sixty
  times a second, and a door that falls on such a change reads as a jump that is not there.
- `node tools/film.mjs output/film 1024x1024`: the whole loop as PNGs, each moment held and drawn twice before
  it is taken, at `DPR` (2) times the size for ffmpeg to shrink back. `LAPS=0,2` films a shorter loop through
  only those doors: every lap starts where every door leads, so any of them loop; the speed and the lean into
  turns (which goes with speed squared) are kept as in the full loop. The garden through doors 0 and 2 is 639
  frames, 21.3 s, against 1080 and 36 s. `FROM`, `TO` for part of it; frames already there are not made again.
  `ffmpeg -framerate 30 -i output/film/f_%04d.png -vf scale=1024:1024:flags=lanczos -c:v libx264 -crf 18 ...`
- `node tools/export-blender.mjs`: the world for `blender/` (see its README); `LAPS=0,2` writes only the eye's
  path, `data/path_02.json`.
- All of them take `URL` (the dev server on 5315 by default).

## Not done yet

The oasis does not fade when come near (`vanishFrom`, `vanishTo` are there for it). The palms are flat screens,
fine from 250 m and no nearer. The cover is a Cycles frame of the garden (`blender/`), the right door close up.
