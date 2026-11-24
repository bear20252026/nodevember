# 13-labyrinth

An endless pile of cubes with stairs, curved stairs, arches and windows on it, after a picture in the spirit
of Escher's Relativity, path traced: three gravities, one for each way a face can look, and people walking,
climbing, falling into holes and sitting in windows under all three. One way runs through the whole pile in
the direction the picture drifts, and the walkers on it keep up with it: 48 seconds, and it loops exactly.
`planet.html` is a ball built of the same things.

```sh
npm run dev
```

Drag to wander, wheel to zoom, click someone to go with them (the world turns so that they stand upright), T
turns the world a third of a turn; `another` in the panel (top right, closed) for a new pile. The switch at
the top goes between the pile and the planet.

## The pile (`index.html`, `src/stairs/`)

- **The pile** (`world.ts`) is a stepped surface: columns of cubes whose height never rises as you go along
  either axis. Seen along the cube diagonal it shows every face, the three directions in equal measure.
  Written as `H(i, k) = g(i, k) - i - k`, it repeats on the screen when `g` repeats, so one tile scrolls for
  ever. A random pile is the plain pattern of cubes with single cubes added and taken away where the rule allows.
- **On it**, each thing in one unit cell: stairs in an inner edge (floor and wall, or wall and wall: the
  upright pleats), fans (a quarter turn of steps) and small cubes in an inner corner, arches cut into faces,
  standing on the floor as doors where they can. Each is laid by one of the cube's 48 symmetries, so there is
  one staircase, one fan and one arch.
- **Cubes with an arch in each wall.** Two arches in the walls of one cube are always alike, upright, and joined
  into one room (each for itself, they cut across one another inside it). They come three ways: an arch whose
  cube has its other wall bare gets a twin there, and some bare cubes get a pair outright (`pairs`); and a few
  cubes whose two walls stand on floors at one level get a door each side, to walk through, the two floors
  being cleared of whatever stood on them (`passages`). All of it is cut into the finished pile: nothing else
  moves. `flights` (long flights laid on purpose) is still in the panel, at 0: it sorted the pile into places of
  stairs and places of doors.
- **Fans** lie four ways, not six: the two that turn the fronts of their steps to the floor, hanging over it,
  could not be walked on, and are laid the other way up against the same wall.
- **The light** (`trace.wgsl`) is a small path tracer over the grid of cells: a ray only ever asks about the
  cell it is in, and meets steps exactly. A very wide sun (50 degrees across), sky, three bounces off the
  clay: it is the width of the light, not any screen-space trick, that keeps flat faces from being one flat colour. It adds a sample
  a frame to one tile (about 13 a second at 2048 x 3547), and the page only scrolls the tile.
- **What only light that goes from thing to thing shows** (so that it is not taken for shading in corners): some
  of the rooms behind the arches are lit from within, by their back wall, and their light falls out over the
  floors and walls about them (`glow`, `glowTone`, `glowPower`); some columns, and the small cubes, are polished
  gold, and show the pile in them, the lit rooms, and the sun where it is met (`gold`, `polish`, `metalTone`,
  `blur`). (Painted columns in four colours were tried, and were too loud.) A turn off gold is not counted among the three bounces (up to five
  of them): folds of gold face one another, and a ray counted out between them came back black. And the pile falls away
  along x and z, so gold that leans that way shows the sky below the horizon, its dark bottom, which looked like
  soot in the folds: seen in gold, the sky is never lower than at the horizon, and `shine` times brighter. (The
  light gold throws onto the clay about it is as it is.) `dusk` in the panel brings the sun down, so that the
  lit rooms light the pile; `day` puts it back. (The people are not in the light's world: the gold does not
  show them, though they take their light from it.)
- **Settling.** One sample of the whole tile is about six frames' worth of work, so it is done a band a frame:
  each band is timed on the graphics card (a timestamp query), and the bands are made as tall as fits in 0.6 of
  a frame. And while the samples are few the tile is shown cleaned (`clean.wgsl`): every pixel borrows from
  pixels nearby on the same face (same normal, same plane, from a guide picture made once), twice over, far
  apart and then close. The cleaned picture gives way to the true one in proportion to the samples, and is gone
  at 128. `smooth` and `clean` in the panel turn the two off. `node tools/stairs-pace.mjs` measures the frames.
- **The people** (`people.ts`, `people.wgsl`) are not in the bake: they move, and the bake cannot. They are drawn
  over the tile every frame, a figure being sixteen capsules, each a small rectangle of the screen in which every
  pixel finds its own point of the capsule. Sitters are in the arches that do not come down to a floor, on
  the sill with their legs out, each in its arch's own way up: upright in a window, and in a hole in a top
  lying back in the hole, face to the sky, legs out over its edge. Walkers go round ways that `routes.ts` finds:
  - Every face of the pile is a floor for someone: the tops for those whose up is y, the faces toward +x for
    those whose up is x, toward +z for z. A staircase in an inner edge is the same shape seen from either of
    its faces, so it serves both of them (as in Relativity); a fan serves those whose up is the line it turns
    about; a cube with a door in each of two walls is a way through.
  - The places to stand are the bare floors and the lowest and highest steps of each staircase and fan. Two
    places join where they touch, along an edge at least a tenth of a cube long, less than a step apart in
    height: so the top of a staircase joins the landing ahead of it and the one beside it, and the foot of one
    joins the head of the next (flights chain, and stairs meet in inner corners).
  - Cells are named as the pile repeats them (the column round the tile, and x + y + z), so the endless pile
    is one finite map. A round on it either closes in the world, or comes out one repeat further on, which
    looks the same; the walker is brought back by a repeat when it leaves its tile.
  - A floor with an arch cut into it is a hole, not a floor: nobody walks over one. A few walkers come up out of
    one hole (thrown up from below, slowing, onto the edge), walk some way, and fall into another; they are out
    of sight in the pile at both ends, so each time round begins again unseen. (Windows are holes too, to those
    whose floor is the wall.)
  - Ways are found by searches with random costs (stairs and doors cost less), as rounds, out and back, or from
    hole to hole. Each is then walked once in advance against the shapes themselves (`solid.ts`, the same shapes
    as the shader's, asked on the processor) and kept only if the body and head never go into the pile and the
    hands and feet do so only for a moment; and a staircase is walked only if the cell above it, along the
    walker's up, is clear (on its upper steps one stands up into it). A knee is let into a step: the stairs are steep (a riser is a fifth
    of a walker's height), and going up the knee goes into the step before it, hidden from above by the riser or
    by the walker; counted, it kept almost everyone off the stairs that are walls to the floor. And for each of
    the two gravities that are not the floor's, if no one is on stairs yet, the best such way that fits. The best that fit and do not share a cell
    are kept, short enough to walk at `pace` in a loop. Sitters within a tenth of a cube of a walker are left out. Every window that is not upright, and every hole, gets
    someone; some of the upright ones do (`sitters`), and two in three of those sit across the window instead, on
    its side, the one whose up is a floor's (+x or +z), as the walkers of the walls would (always one of two
    windows joined in a cube: one sits up, one across). One laid that way is kept only if it stays out of the
    pile. Each foot goes
    on every tread of a staircase, and a stride apart on the level. A whole number of rounds a loop, and an even
    number of strides, so the loop closes.
  - The hips: as high as a straight leg holds them over the footholds either side, on a level that climbs late
    going up (the leg put down lifts the body) and early going down (the leg stood on bends and lets it down);
    and never higher than a foot on the ground can reach. So the leg put down in front is straight (a "straight"
    leg is 99.9% of its length: at 98.9%, as it was, a two-bone leg is already bent 17°), and the one behind bends
    as it pushes off, its heel up. A foot leaving holds the body as it did at its push off and gives way at a
    steady rate (so a climb is made at a walking pace, not in a hop); a foot landing takes the weight from out of
    all bounds. Checked by `tools/stairs-closeup.mjs` and side views of a made-up way: about 5° at the knee
    standing and at the heel strike, 40° pushing off, 50° at most in the swing on the level.
  - The foot in the air goes forward at the pace of the body (half eased: one that got there too soon would wait
    out of reach and the knee snap straight), turning about the up (a half turn on the spot went through
    nothing); on stairs it follows the steps a riser at a time, lifted as it sets off going up, out over the edge
    first going down, where it lands on the ball of the foot. Walking: the heel lands first, toes up, the foot goes
    flat, the heel rises as the other leg passes; the hips lean over the foot they stand on and turn a little with
    the swinging leg, the shoulders the other way with the arms. The upper arm swings, and the forearm follows a
    moment late, bending as it comes forward (17° to 35°), the hand coming in a little toward the middle; the hand
    goes on from the wrist, the way the forearm points. The lean, the head's nod and the arm swing are blended
    from foothold to foothold, so they do not change all at once where stairs begin. The head looks down on stairs
    and now and then about. Each walker has a size
    of its own (7% either way), its own arm swing, and some walk with their hands in their pockets, or with a
    phone, looking at it.
  - Now and then one stops on the level and looks at its phone (a small lit screen), or about, or at its watch,
    or stretches. The stops are in its time round, so the loop still closes; it eases from its stride into a
    stance (weight shifting, breathing) and back. Some sitters have a phone too, and look up from it now and
    then.
  - Every walker is tried as it is (its size, its stops) as well as plain; one that would go into the pile is
    made plain. The head is tried as a ball, so that it does not graze walls.
  The figures are hidden by whatever of the pile is nearer (the guide picture has its depth), take their light
  from the tile where they stand (the tile keeps, beside its light, how much of it is the sun's own), and take
  that much of the sun's light and some of the rest off the ground about them, which is their shade. The shade
  is made in a pass of its own at half the screen's size each way, from the parts of a figure that cast much
  (body, head, legs): it is soft, so that is enough, and at full size it cost more than all the rest. `walkers`
  (the share of the ways found that are walked), `sitters`, `tall`, `pace`, `shade` in the panel.
  `node tools/stairs-clip.mjs dir` writes frames of the loop (`SET='{"drift":0}'` to hold the picture still).
- **Looking about.** Drag to pan, wheel to zoom. Click someone to go with them: the view comes round to them,
  closer, and turns so that their up is up the screen. Seen down the cube diagonal, the pile looks itself
  turned by a third of a turn, and then the floors of another way up are the floors: those who walked the
  walls now stand upright, and the light comes from the side. T turns the picture a third of a turn; Escape,
  or a drag, lets go. (The turn is only of the finished picture, so it costs nothing; Space is ssam's own play
  and pause.)
- **The way through.** One path is cut into the pile (`world.ts`, `path`): along x and down, stairs and fans with
  a little level ground and a jog across a row and back now and then, coming out a repeat of the pile further on,
  where it began. Along x the pile goes down a cube a column, so a level step along x must be paid for by a level
  step back across a row: the jogs make the landings. Walkers on it (`onWay`, spread along it) go once round it a
  loop, and the picture drifts by the same repeat a loop: so they keep up with the view and are never seen to
  come back. The picture drifts half a tile a loop (`drift` 0.5; the loop is 48 s); for that to close, a pixel and
  its twin half a tile on are given the same random numbers in the trace (the tile is an even number of pixels
  high), so the light is the same in both.

## A ball built of the same things: `planet.html` (`src/planet/`)

Not a picture laid on a ball, but a body: a ball of cubes with the same stairs, fans, small cubes and arches on
it (`src/planet/world.ts`), turning. The flat pile shows one side, every face of it looking along (1, 1, 1); a
ball has eight such sides, and the one rule (a cube is there only if the cubes behind it, toward the middle
along each axis, are there) makes each of them a pile like the flat one. An empty cell touching two cubes can
take stairs, one touching three a fan, stairs or a small cube; a cube's bare face an arch, and two arches in
one cube are alike and joined. The shapes are the stairs page's own: the shader takes them out of its file.

The ball turns round the line toward the sun, so the sun (and the sky, fixed to the ball as well) meets every
point of it the same way all the time: the light on a point never changes, and can be gathered once and kept
on the ball. Every flat face is cut into small squares, `texel` to a cube in its own plane (the fan risers and
arch vaults, which look along no axis, into small cubes of space), and each square is a slot in one table on
the graphics card, found by hashing what the square is. Each frame a scatter of points (`gather`) takes one
path-traced sample where its ray meets the ball and adds it into its square, until the square has `keep`;
then that square costs nothing more. Painting reads the four squares about each point, with four rays a pixel
for smooth edges (`rays`). A point seen for the first time shows a guess (the sun unshadowed, and the sky)
until its square has a few samples; after one turn of the ball the whole of it is clean, and stays clean.
Dragging across turns it further round the sun; dragging up or down shows its far side, in shade. A new ball,
or any change to the light, starts the gathering over. No people on it yet. The pile's tools work with `URL=http://localhost:5313/planet.html`.

Gold and lit rooms, as on the stairs page. A ball has no one up, so what is gold is a line of cubes going out
from the middle along the axis it is farthest along (which is up for whoever stands there), with what stands in
its cells; and the small cubes (`gold`, `polish`). Some of the rooms behind the arches are lit from their back
walls (`glow`, `glowTone`, `glowPower`). Gold cannot be gathered and kept, as it shows what it faces the way the
eye sees it, so the painting follows the eye's ray on from gold (up to five turns, for folds of gold that face
one another) and reads the light kept where it ends; the gathering does the same, so what is seen only in gold
has its light gathered too, and the light that bounces about the ball is turned by gold and brought by the lit
rooms. Nothing in it is noisy. On a ball gold mostly faces the sky, where on the flat pile it faces more pile:
the sky seen in gold is `shine` times brighter, or it looked like dull bronze.

## Tools

- `node tools/stairs-film.mjs out 1080 2880` — the whole loop, square, centred on the way through, a 60 fps frame
  at a time, and `out.mp4` (`SET='{"res":2816,"zoom":0.475,"samples":256}'` for the posted one; `STILLS=1` for four
  stills first, `RESUME=1` to go on from where it stopped).
- `node tools/stairs-shot.mjs out.png 1200x1200 96` — a still after that many samples (`SET`, `CENTRE`, `HOLD`).
- `node tools/stairs-clip.mjs dir 800x500 48 0 0.1` — frames between two moments of the loop.
- `node tools/stairs-closeup.mjs dir <figure> 24 0.1 0.13` — follows someone at zoom 4 (`UPRIGHT=0` leaves the
  world unturned).
- `node tools/stairs-cost.mjs` — the page's cost at retina size on the graphics card (`SAMPLES=12` to time the
  showing alone, once the light is done).
- `node tools/stairs-follow.mjs out`, `node tools/stairs-pace.mjs` — checks of going with someone, and of the pace.

The panel's `faces` shows which way each surface faces, for finding holes.
