# 14-tension

A sheet hung in the air on seven cables, and things nobody sees coming up from below. Only the cloth shows
them. Light comes through it where it is one layer thick, less and redder where it lies behind another.
This is the main page (`index.html`); the day's first idea, a rope torn in a zoom loop, is `rope.html`.

```sh
portless            # https://tension.localhost
npm run dev
```

Four shows (the show menu, or `?show=`):

- **waltz** (the default): `public/waltz.flac`, 1:56.70 to 2:14.68 of a recording of the Blue Danube (the
  first theme's second half, bars 17-32, and its cadence G, A, D), with 0.3 s of silence before and 1.0 s
  after: a 19.28 s loop that opens with every shape down (one already up when the sim starts tears the
  fresh sheet). Its notes are in `src/cloth/waltz.ts`, in seconds (the orchestra plays freely), read off
  the recording against the score and then tuned by eye (the upbeat D left out, a few holds set by hand).
  A drum per pitch class (D E F# G G# A B C#) round a ring: octave sets how high it pops; a held note stays
  up till the next and sweeps on round the ring while it sounds (`SWEEP` in show.ts); a chord's drums rise
  together; a repeated note dips and strikes again. Each drum's keys are built over three loops, so the ones
  striking across the wrap run on. The recording follows the sim's clock, taking up drift by nudging its
  speed (within 8%) and jumping only when 0.25 s out. The shapes run 0.39 s behind the sound (peaking on
  the note looked early: the eye takes a bump as it rises). Seam 2.1 mm rms. The recording is someone's
  performance: check its rights before publishing.
- **danube**: the theme's opening phrase twice and a D major chord, played by a small Web Audio synth
  (`src/cloth/music.ts`, score in `src/cloth/danube.ts`, 120 bpm, 16.5 s), a drum per pitch on two rows,
  each note sounding in the frame the sim passes its beat. `tools/danubewav.mjs out.wav [periods]` renders
  it offline, to lay under a take. Seam 1.7 mm rms.
- **beats**, silent, 96 bpm, 32 beats (20 s): four drums in a row taking turns, a ball breathing on every
  other beat, a cube twisting on each beat, a ring with drums on the off beats, the face (mine, the distance
  field from day 3, baked by `tools/bakeface.mjs` into `public/face.sdf`) looking about, and an egg.
  Keys are `[beat, x, lift, z, yaw, tilt, ease]` in `src/cloth/show.ts`.
- **manual**: nothing moves till one presses on the sheet (`src/cloth/touch.ts`). Press, and a shape comes up
  under the pointer there (mostly a drum, now and then a ball, a cube on its corner or an egg); drag, and it
  follows under the cloth (at most 2 m/s, so a flick can't tear it); let go, and it drops faster than the
  cloth falls. One shape per pointer, so each finger on a phone gets one. The pointer is cast onto the
  resting sheet (a ray to the plane, then corrected a few times for the sheet's height there). Here the
  left button and one finger are the hand's; orbit with the right button or two fingers.

Two looks (the look menu, or `?look=`): **c** (default), seen from above, an off-centre spot sweeping the
sheet from a hot far corner to the near edge, light from below coming through (white through one layer, red
`deep` through more), the tones mapped in stops below `white` through an S (`contrast`) onto a Catmull-Rom
ramp of plum, wine, coral, cream (`grade`); and **d**, iridescent, a nap like velvet or flip sequins: the
hairs all lean one way, combed along the sheet's grid (`tilt`), the colour running with the angle between
the view and the hairs round the hue wheel (`bands`), with a Kajiya-Kay glint along them, and pale cables
that read on the dark. (Brushing the nap where the shapes touch was tried and dropped: it left marks. Two
earlier looks, a low sun behind the sheet and a plain spot, are in the history.) Two lights, each with its
own two depth layers.

Published, the panel is only the look, the show and the sound. In dev (or with `?dev`) there is every knob,
the stats, and:

- a note editor for the waltz (`src/cloth/editor.ts`, `e` hides it): a row per drum over the waveform, each
  note a bar as long as its drum stays up (blue octave 4, yellow 5, red 6, chords outlined). Click to mute,
  drag the right end to hold it longer or shorter, shift-click to reset; edits apply live, and "save" writes
  them to `public/waltz-edits.json` (a dev-server endpoint in vite.config.ts, which doesn't watch that file,
  so saving doesn't reload), which the page reads at start. The build leaves the editor out.
- `[` `]` move the shapes 10 ms earlier or later against the sound (shift 50), kept as `?lag=`.
- `c` saves the camera (copied, and put in the address as `?cam=up,turn,dist,fov,tx,ty,tz`, which brings it
  back).

Live it is 320 x 320 particles, 24 substeps (about 7 ms a frame); a recording keeps to the playhead however
slow, so take it with `?n=512&sub=32&loop` (`?loop` runs one period unseen first). Takes are silent: lay
`public/waltz.flac` (or a `danubewav` render) under them with ffmpeg; a `?loop` take starts on a period, so
they line up. The film: `URL="http://localhost:5314/?loop&n=512&sub=32" node tools/clothrecord.mjs
output/waltz-c-take.webm 1920x1080`, then `ffmpeg -i output/waltz-c-take.webm -i public/waltz.flac -map 0:v
-map 1:a -t 19.28 -c:v libx264 -pix_fmt yuv420p -crf 18 -c:a aac -b:a 256k output/tension-waltz-1080.mp4`
(its seam frame differs from the next no more than any two frames do). `public/cover.jpg` is 2.55 s in,
the held D's drum up. `?dpr=` caps the pixel ratio (1.5). The weight slider is the sheet's density (1 kg/m²): air
drag is per area, so it acts as 1/density, and a heavier sheet falls faster and pulls the cables harder.

- `src/cloth/cloth.wgsl`, `src/cloth/sim.ts`: the cloth on the GPU, raw WGSL on three's device, writing
  the textures the mesh reads. XPBD with one Gauss-Seidel sweep per substep (32 substeps a frame): every
  stretch, shear and bend constraint of one kind and colour touches a particle at most once, so 12
  dispatches solve them all with no races. A fine sheet solved like that stretches like rubber, so every
  particle is also kept within its flat-sheet distance of each pin (long range attachments), first in
  each substep so the edge passes mend what that tugs. The pins are small heavy bodies on elastic cables.
  They feel that pull back (summed in fixed point, so in any order the same), and give way when the
  sheet is pushed. The pushers are signed distance shapes; a particle that was outside at the start of
  the substep is put back on that side, so a thin finger can't pass between particles.
- `src/cloth/show.ts`: the pins and cables, and each shape's path, keyed on beats: a pop peaks on its beat (fast, braking), a drop falls faster than the cloth so it lets go, and keys give heights above the resting sheet, so a lift means the same anywhere on it.
- `src/cloth/main.ts`: drawing. The light's view is rendered twice, depth peeled: the first surface and
  the one behind it. Each point counts the layers between it and the sun (a rotated disc of taps, wider
  the further the layer in front is), and each layer passes `through` x `transmit` of the light (about
  45%, warm). A face turned from the sun shows the same fraction through it, brighter looking towards
  the sun; both sides are wrapped at the terminator. (A first, saturated version drew a dark seam on
  every fold and pasted-looking peach shadows.) Plus Charlie sheen, sky,
  and darkening in hollow folds (the Laplacian along the normal, from the sim).

What it took:
- Pins on light damping (3/s) rang at about 3 Hz and yanked the whole sheet; around a finger tip that
  tore the cloth open. Near critical damping (25/s) fixed it, not friction or collision changes.
- The tethers ran after the edges at first, so where they fought a pusher nothing held neighbours
  together. Tethers first, then edges, then collision.
- Bands on the calm sheet: a low sun grazing the ripples found the cloth in front of itself. The layer
  lookup is from a few texels off the sheet on its sunny side, a layer fades in over 2 cm instead of a
  hard step, and the sun's view is cropped to the sheet (1.75 m).
- Small shapes (a 4 cm finger, a cone) pulled the inextensible sheet into steep spikes that looked
  wrong; big ones read well, so the show uses only big ones.
- Live, the sim takes at most one frame per frame drawn. Catching up with the playhead (two steps after
  a slow frame) made every frame slower: 26 fps. Recording keeps exactly to the playhead instead.

Tools: `node tools/clothshot.mjs out.png 1280x720 3 8.5 ...` (frames at those sim times; SET, PHYS, EVAL,
N, Q for the query: the default show is the waltz), `node tools/seam.mjs [periods]` (how far each period's start is from the last), `node
tools/clothrecord.mjs take.webm 1280x720` (one period through ssam).

# rope.html

A stone lands on a rope and tears it, but the rope's own core, thinner, still holds. It throws the stone
up; the stone comes down and tears that, and the next core holds, and so on inwards for ever. The
picture zooms in by 2 every tear, so every tear looks like the first, in a seamless 2.4 s loop.

### How it is made

- `src/sim.ts`: the rope, in 2D (position-based, substepped). It is one chain whose segments belong to
  generations: 0 the rope under the stone, 1 the one torn last, and so on outwards, each twice as thick
  and long as the next. At a tear the middle 32 of the 72 segments of generation 0 become a whole new
  rope of 72 (its core, a little longer, so it is slack), the outermost stubs go, and everything is
  doubled. The halves of the torn sheath stay as tails hanging from the torn ends.
- Older rope lies on two rays from the centre: a self-similar chain has to, if it is to come back to
  itself after a doubling. Stubs are drawn to their rays (gently at first, firmly by their third tear).
- `src/bounce.ts`: the stone does not feel the rope; it follows a bounce made once from a spring and
  gravity: caught by the core, thrown, flying, landing on the next rope, pressing it down to the tear.
  For it to repeat, the tear must neither give nor take energy (k1 r1² = k2 r2²); then only the speed
  at the tear is left, found by bisection so that the bounce takes exactly one period.
- `src/bake.ts`: runs the chain unseen for 14 periods until it repeats itself (to ~1e-7 of the
  picture), and keeps one period; the page plays that.

### Why it loops

A zoom loop multiplies every error by 2 at each tear, so whatever is free has to forget its past
faster than that. What it took (tools/run.ts prints how far each period is from the one before, and
which node is worst):

- The stone on a prescribed path. Free, its sideways drift doubled every tear (0.004, 0.009, 0.018, ...)
  and its bounce was chaotic.
- Tear the same nodes every time, not the ones nearest the stone (that flips between neighbours).
- Air drag 4/s on the rope. Neighbour damping damps only bending, not the whole rope swinging, and at
  0.35/s nothing converged (stuck at 0.1). At 2 it converges slowly, at 4 to 1e-11 in 11 periods.
  Thin rope does have a lot of air for its weight, so it reads as natural.
- The tails' rest length doubled with them at a tear (missing that, they snapped into knots).

### Tools

- `node --experimental-strip-types tools/run.ts [periods] [sheet.png]`: run headless, report, draw 2D frames (`LAST`, `PER`, `COLS`, `PX`, `SET`)
- `node --experimental-strip-types tools/bake.ts [settle]`: bake time and how exactly it repeats
- `node tools/shot.mjs out.png 800x600 0.0 0.5 ...`: render the page headless at those phases (dev server on 5314, or `URL`)

