# 16-spore

Enoki, lit from inside. New mushrooms keep coming up through the middle of the pile and shoulder the older ones
aside; the eye climbs with them and the pile turns slowly past. Spores hang in the air. It loops every 12 seconds.

```sh
portless            # https://spore.localhost
npm run dev         # or a numbered port (the tools expect 5316: npx vite --port 5316)
```

## How it loops

After one period the whole world is the same, 2 units higher and turned by 45°. So there are only 124 mushrooms
(`keys`), each born again every period a step up the screw. `tools/bake.ts` grows the pile, and keeps one whole
life of every key in `public/spore.bin` (3.4 MB). The page draws each life up to three times over, a period
apart, each older copy a step lower and turned (`src/stage.ts`); about 300 stand at once. The last frame meets
the first whatever the lives were: the bake only has to settle well enough that copies of different ages do not
stand in each other.

A pile of 46 settled by itself (0.02 stem radii between generations). This one does not: left alone, some stems
come out five radii away from one period to the next. So after three periods left alone the bake takes the mean
of the next three as a guide, and from then on draws every stem towards what its key did (`GUIDE=3` a second).
That brings it to 0.02 radii on average, the worst stem under three radii at its worst moment.

`density` on the panel draws a share of the baked mushrooms. A key left out is left out in every copy, so the
loop holds at any setting; the ones that stay keep the places the full crowd pushed them to.

```sh
node --experimental-strip-types tools/bake.ts            # 18 periods, about 8 minutes, writes public/spore.bin
SET='{"NK":60}' SVG=pile.svg DRY=1 node --experimental-strip-types tools/bake.ts 7   # try a pile, draw it, keep nothing
```

## The pile (`src/sim.ts`)

A stem is a chain of 28 segments clamped at its root, lengthening along its whole length. Each has a shape of
its own: leaning out from where it stands, straightening as it climbs, wandering a little, nodding at the top.

What gives the eye something to follow:

- Growth comes in spurts. A first shoot from the root, then two or three more, each a second or so long with a
  rest of one or two seconds between (`SPURT`, `REST`); only a sixth of the length comes steadily. Every key has
  its own timing.
- A cap stays a pin until the stem is a little short of its full length (`POP_AT`, 82 to 93%, during its last
  spurt, so cap and stem land together; opening after the stem had stopped looked odd), then opens in half a
  second, overshoots and settles (`POP`),
  shoving whatever stands round it.
- A cap has weight. Two fifths of a stem's sideways hang (`DROP`) comes all at once as its cap opens, so the stem
  bows under the new load and bobs on its spring (this took the place of an arbitrary throw, `KICK`, now 0). And
  in the picture a cap leans against the throw of its stem (`flop`, the "cap flop" slider): how hard the top is
  being thrown is read off its own baked track a kept frame either side, so it is the same every time round,
  needs no rebake and cannot open the seam.
- Growing tips circle (`NUT`, `NUT_T`), as they do in timelapse: a turn every 3 to 5.5 seconds, never quite round.
  A grown stem keeps three tenths of it for good, so nothing in the pile is ever quite still. Before this a fifth
  of the pile stood dead still against its neighbours at any moment, and under a sixth of the old stems moved.
- A stem is a spring about its own shape, and how fast a part of it swings depends only on how far it is from
  the root (`SPRING`, `SPRING_AT`, `SPRING_POW`: as a rod with a weight on its end, frequency falls as distance to
  the power 1.5). A short stem quivers, a long one sways at about 1 Hz. The damping is a share of critical
  (`RING`) and not a flat drag, so every part swings the same few times after a spurt, a pop or a shove. A flat
  drag had the slow top nearly dead and the stiff foot ringing where nobody sees it: one overshoot, then still,
  which read as plastic. `tools/wobble.ts` measures the swing (the track of each top less its one second mean).
- Births come in three flushes a period, four times as thick at the middle of a flush as between (`WAVES`,
  `BUNCH`).

- Roots are born in a small disc under the picture, among the stems already there. Stems and caps (a ball on
  the tip) part wherever they overlap, at the nearest points of two segments.
- The spring to its own shape is also what makes the loop possible. A chain held only by its bending buckled
  into spaghetti under the crowd; held to a shape, the crowd settles nearly the same way each period.
- Once grown, a stem slowly comes to hang out sideways, the way it leaned (`SAG`). Old mushrooms are the low
  ones in the picture, so the pile opens like a bunch: new ones straight up the middle, old ones out at the sides.
- The eye climbs at a steady pace, so a stem that has stopped growing sinks out of the picture. Each cap rises,
  hangs, and sinks.

## The light (`src/look.ts`, `src/stage.ts`)

There is a lamp inside the pile (a glowing length of its axis, low in the picture) and a cool light outside,
from behind on the left.

- Each frame the stems are written into a box of how full of mushroom each place is. One sweep outward from the
  lamp, in a grid round the axis, gives for every place the flesh the lamp's light crossed on its way; one sweep
  along the outside light gives the same for it. The picture reads each once. Light that crossed flesh loses
  blue first, so the pile goes from white to cream to orange to red with depth.
- A stem or cap is lit on the side facing a light, and on the far side by what comes through its thickness:
  more at the edges, where it is thin. Edges turned from the eye catch the lamp too.
- The air scatters the lamp a little; the walk through it reads the same grid, so stems leave shadows in it.
- A lens of my own (`src/lens.ts`): three's depth of field drew a dashed line beside every stem.
- Spores (`src/motes.ts`) are motes standing still in the air, drawn after the lens, each as the disc the lens
  would make of it.
- Spores pour from the ripe caps (`src/pour.ts`). A cap lets them go in spells of two to five seconds with rests
  between, thick at first and thinning, from its gills. Each spore is a fixed moment in its mushroom's life:
  where the cap was then is read off the baked track (so a pour trails behind a cap that sways, and is not
  carried about with it), and where the spore has got to since is a formula of how long ago that was: it gathers
  speed, falls, strays with the rest of its pour and a little on its own. So a pour is replayed with its
  mushroom, the loop stays exact, and nothing is baked: how many, how fast and how far they stray are sliders.
  The page only finds where each was let go; the fall and the straying are worked out in the vertex shader
  (all on the page, 36 thousand spores took 7 ms a frame; this way 3). They are lit by the lamp through the
  pile, and by the cool light outside, which is all that reaches them up among the caps.

The panel has every number. `?tone=aces` or `agx` changes the tone curve (it is `neutral`, which keeps the
orange).

## Tools

- `tools/shot.mjs out.png 900x1600 0.3 0.6`: the page headless at moments of the loop; `SET='{"lamp":3}'`, `DPR=2`.
- `tools/film.mjs out.mp4 720x1280 30`: the loop as a film, frame by frame from the page held at each moment.
  The one for posting is `DPR=2 CRF=16 node tools/film.mjs output/spore_x.mp4 1024x1024 30` (drawn at 2048 and
  brought down; about 5 minutes). `output/spore_thumbnail_2048.jpg` and `public/cover.jpg` are 0.42 of the way
  through the loop: `DPR=2 node tools/shot.mjs out.png 1024x1024 0.42`.
- `tools/trace.ts out.svg`: the baked caps' heights and sideways places against age, to see the motion without the picture.
- `tools/perf.mjs 1600x1000 2`: frames a second the GPU finishes, with parts off in turn. About 85 at
  3200x2000 on the Mac.
- `tools/cpu.ts`: what replaying the pile and sweeping the light cost a frame (about 5.5 and 3 ms in node, less
  in the browser).
