# Nodevember 2026 · Day 23 · Analogue — Rain on Vinyl／一圈的雨

2026-11-25 · Blender 5.3 · Geometry Nodes and Cycles · 1080 × 1080 stills and a 7.8 s clip with stereo sound

## Idea

A black record with a rain shower cut into it. The needle reads it from scattered first drops through a downpour and
back to quiet, while warm and cool-grey side light rakes across the fine grooves and the diamond tip.

**Constraint:** the whole record is one continuous spiral groove. The record, the pickup and the stylus are all
generated in Geometry Nodes. No image textures, no imported or modelled meshes.

## Build

1. **One groove.** A Grid 82 945 samples long and 7 rows wide is wound into a spiral of 192 turns. Integer sample
   numbers give every turn exactly the same angles, so the outer row of one turn lands on the inner row of the next and
   the turns are welded into one surface. The pitch (0.003 units) and the shallow cut (0.00042) follow a macro photo of
   real LP grooves ([Evan-Amos, Wikimedia Commons](https://commons.wikimedia.org/wiki/File:12in-LP-Vinyl-Record-Macro-Grooves.jpg)).
   Two shallower bands catch the side light like the quiet rings on a real record.
2. **The rain.** One shared node group, `PA_Rain pressure`, adds three streams of drops. Each drop has a fast attack, an
   exponential decay and a low carrier, and a Gaussian storm envelope swells and passes. Every point of the spiral stores
   its playback time and reads the rain at that moment, so the groove swings sideways with the storm. The needle reads
   the same group at the current playhead, so it follows the cut it sits in.
3. **Stereo micro-cut.** The vinyl material reads the playback time again and drives two 1D noises as left and right
   channels. Their sum moves the whole groove sideways, and their difference opens and closes the walls and lifts the
   floor, as on a 45/45 stereo record. It is true displacement. The 48 turns around the needle are split off as their
   own object and diced by Cycles to about 1.5 pixels, so the relief is real geometry only where the lens looks.
4. **Tool marks.** A mask stored on the groove walls limits short graver-chatter cuts, fine striations and patchy polish
   that follow the turns, so every turn catches the light a little differently.
5. **A classic pickup.** Rebuilt after photographs of 1970s moving-magnet cartridges:
   - a brushed aluminum block with a black side label reading **RAIN 023**;
   - a red push-in stylus holder at the lower front, with a V notch over the cantilever and the black damper;
   - four gold pins with red, green, white and blue leads;
   - a black universal headshell with two half-inch slots, slotted screws and a curled finger lift.
6. **The stylus.** A drawn aluminum tube tapers and is flattened over its last 0.7 mm, then cut square. A clear
   eight-faceted diamond (IOR 2.417) is set through it, with a dark glue bead underneath. The tube pivots at a rubber
   damper and re-aims every frame as the tip follows the rain.
7. **Light.** Warm and cool-grey strip lights rake across the record. The tall cartridge body would shade the groove
   under the needle from the rear blue strip, so shadow linking lets only the record, platter, deck and cantilever
   block that one light.

Exposed sliders on `PA_Vinyl_lathe`: **Groove depth** and **Signal swing**. The needle follows both.

## Animation

7.8 s at 24 fps. A 1:1 camera starts high on the arm, the cartridge and the platter edge. From frame 28 it pushes in and
turns almost to face the pickup, ending on the vertical diamond in its groove, about 29 times closer than the opening.
Once the camera is there, the record, the arm and the needle, which share one playback clock, slow down over 12 frames
to 1/90 speed, like a high-speed camera. For the last 1.8 s the wavering grooves slide slowly under the tip while the
rain plays on at normal speed. 180° shutter motion blur.

## Sound

48 kHz stereo, synthesised from many small events:
- a pinkish hiss of distant rain;
- random drops, rising from about 260 to 2500 a second with the storm, about one in ten trapping a bubble that rings
  with a slightly rising pitch;
- the three streams that cut the groove, as close drips in time with the needle's swings.

It is band-limited to 35 Hz–13.5 kHz with a faint surface crackle.

## Files

- `rain-on-vinyl.mp4`: the clip, 864 × 864, 24 fps, stereo sound.
- `render.png`: opening view, 1080 × 1080.
- `stylus-detail.png`: the diamond in the groove during the slow-motion hold (frame 175), 1080 × 1080.
- `nodes/`: the node trees:
  - `main.png` (the record lathe);
  - `rain-pressure.png`;
  - `vinyl-material.png` (tool marks and stereo micro-cut);
  - `cantilever.png`;
  - `stylus-holder.png`;
  - `headshell.png`;
  - `finger-lift.png`.
- `tutorial/`: a node-by-node walkthrough.

Rendered in Cycles on a second PC with an RTX 4060 (OptiX).

## Caption

**Nodevember 2026 · Day 23 · Analogue | Rain on Vinyl**

I pressed a rain shower into one continuous groove. Three streams of raindrops drive the cut, the needle and the stereo
soundtrack. Watch the warm light catch the groove as the storm swells and passes.

#nodevember #nodevember2026 #GeometryNodes #b3d

## Alt text

A warm three-quarter view of a black record and a classic pickup. It has a brushed aluminum body with a black “RAIN 023”
label, a red stylus holder with a V notch, and a black headshell with two slots, slotted screws and a curled finger lift
on a silver tonearm. Warm reflections reveal bands of fine grooves and the polished platter edge. The camera moves down
to face the thin aluminum cantilever. Its end is flattened, with a clear faceted diamond set through it, resting in the
groove beside tiny machining marks on the groove walls. The camera then holds as the record slows to slow motion, and
the grooves, wavering in width, slide slowly under the diamond.

## Posting

- [ ] Mastodon (mention @Nodevember@graphics.social)
- [ ] Bluesky (@nodevember.bsky.social)
- [ ] X (@Nodevember)
- [ ] Instagram (@nodevemberio)
- [ ] Blender Artists (tag: nodevember)
- [ ] Posted
