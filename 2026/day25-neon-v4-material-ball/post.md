# Nodevember 2026 · Day 25 · Neon — Neon Bulb in the Rain

2026-11-27 · Blender 5.3 · shader nodes and Cycles · a 12 s seamless loop, 1080 × 1080

## Idea

A neon bulb glows inside a wet glass shader ball. Over twelve seconds the gas is pumped down and let back in: sparks,
wandering filaments, a full glow, striation rings drifting toward the centre, the cathode dark space swallowing the
gas, the glass fluorescing green, and back to sparks. Every raindrop on the ball is a little lens that shows the
discharge sharp and magnified.

**Constraint:** one material does everything. The bulb, the gas, the drops, the runners and their trails come from
object coordinates and one `frame / 24` value. There is no geometry inside the ball, and no image textures or volumes.

## Build

1. **A ball and a floor.** A UV sphere with the classic shader-ball groove cut in, on a grey cove that curves up
   behind it.
2. **Rain.** Two layers of static drops are spherical caps on a Voronoi, with a tilted normal and no geometry. Runners
   are one drop per meridian column. Each slides down in three stick-slip stops per pass, a whole number of passes per
   12 s, and leaves a trail that dries in 1.6 s.
3. **The bulb.** The view ray is intersected with an imaginary sphere of radius 0.75, and the gas is sampled at 10
   jittered points along the chord. The gas follows the similarity law of a glow discharge: the cathode
   dark space is 0.064 torr·cm / p, filaments thin and brighten as the pressure drops, and striations appear in a
   pressure window.
4. **The drop lens.** Each drop bends the view ray by the difference between refracting through the drop and through
   the plain glass. The bulb is marched a second time along that bent ray with crisper filaments, and the two views
   mix by how wet the glass is.
5. **Glass.** Almost clear (transmission 0.95, faint blue-grey tint), lightly misted between drops, glossier in them.

Seven shader node groups make up the material (`PA_Rain`, `PA_DropCap`, `PA_RunnerLayer`, `PA_NeonBulb`,
`PA_PumpStage`, `PA_BulbMarch`, `PA_NeonStep`); the material itself is 20 nodes.

## Animation

12 s at 24 fps, a seamless loop. Sparks for the first second, filaments until about 2 s, then the full glow. Rings
drift from about 2 to 6.5 s, the gas goes out from 5.7 s, the glass glows green from 7.6 to 9 s, and the gas comes
back on the way to the sparks at 11.6 s. Two layers of runners slide down twice and three times per loop.

## Files

- `neon-bulb-ball.mp4`: the clip, 1080 × 1080, 24 fps.
- `render.png`: frame 72, full glow, 1080 × 1080.
- `render-200.png`: frame 200, green glass, 1080 × 1080.
- `nodes/`: the node trees:
  - `main.png` (the material);
  - `rain.png`, `dropcap.png`, `runner.png` (the water);
  - `bulb.png`, `stage.png`, `march.png`, `step.png` (the bulb);
  - `ball.png` (the ball and floor).
- `tutorial/`: a node-by-node walkthrough.

Rendered in Cycles, 128 samples, on a second PC with an RTX 4060 (OptiX).

## Caption

**Nodevember 2026 · Day 25 · Neon | Neon Bulb in the Rain**

A neon bulb inside a wet glass ball, pumped down and vented back in a 12 s loop: sparks, wandering filaments, full
glow, striation rings drifting to the cathode, the dark space swallowing the gas, the glass fluorescing green, then
air rushes back in.

There is nothing inside the ball. One material marches the view ray through a sphere in ten steps and lights it with
the similarity law of a glow discharge. Every raindrop is a lens that shows the bulb sharp and magnified. Runners
slide down with stick-slip stops and their trails dry. No image textures, no volumes, one frame / 24 driver.

#nodevember #nodevember2026 #b3d

## Alt text

A glass ball on a dark grey studio floor, covered in raindrops of every size and split by a thin groove round its
middle. Inside it a pink neon glow fills almost the whole ball and lights the floor pink. Through each drop the glow is
sharp, showing bright rings and thin pink filaments. Over a 12 s loop the glow sparks, swells, breaks into rings, fades
to a faint green ring on the glass, and comes back.

## Posting

- [ ] Mastodon (mention @Nodevember@graphics.social)
- [ ] Bluesky (@nodevember.bsky.social)
- [ ] X (@Nodevember)
- [ ] Instagram (@nodevemberio)
- [ ] Blender Artists (tag: nodevember)
- [ ] Posted
