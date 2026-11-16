# Nodevember 2026 · Day 14 · Shell

Date: 2026-11-14

## Idea
- Reading of the prompt (literal / lateral / personal): literal: one node group that grows every kind of shell,
  shown in a black studio.
- One-sentence concept: every shell is one tube that grows, turns and slides: one Geometry Nodes group built on
  David Raup's coiling model (1966) grows a nautilus, an ammonite, a garden snail, a tower shell, a textile cone,
  a conch, a cockle and an abalone, and the video morphs straight from one kind to the next.
- Constraint I'm stating in the caption: every shell, rib, hole and colour comes from one node group's sliders; no
  image textures, simulation or imported assets.
- Technique to learn or show off: Raup's model as one similarity (scale W^(θ/2π), turn θ, slide T) applied to a
  generating curve drawn in the plane through the axis; one welded tube (outside → lip roll → inside) addressed
  by index alone; a "lean" of the aperture out of the axis plane (abalone) and a taper (cone, conch) beyond
  Raup's four numbers; colour patterns (flames, bands, tents, ammonite sutures, breathing holes, thin-film nacre)
  drawn from the shell's own coordinates.
- Output: animation, ~20 s (488 frames), 24 fps, 1080² (1:1), Cycles, black studio; a clean version and one with
  Raup's four numbers read out.

## Research (Raup's coiling model)
- Raup, D. M. 1966, "Geometric analysis of shell coiling: general problems", J. Paleontology 40: 1178–1190.
  W: whorl expansion per revolution; D: distance of the generating curve from the coiling axis (inner edge /
  outer edge); T: translation along the axis relative to the move away from it; S: shape of the generating curve.
  Bivalves and brachiopods sit at very high W (one valve is about a whorl or less); most of the W–D–T cube is
  empty in nature.
- Cone shells need a low W (~1.3, many tight whorls) and a thin, tall, tilted aperture: the gap between whorls is
  1 − 1/W, so a narrow slit means W close to 1. An abalone needs the aperture leaned out of the axis plane (its
  aperture faces down, not sideways); that is a later extension of Raup's model (aperture inclination).

## Build log
- Curve to Mesh orders vertices row by row (index = row × ring + k), so θ and φ come from the index.
- Colours were first written as sRGB numbers into linear slots (everything pale): presets now convert them.
- Subsurface on thin walls made the abalone's dark outside glow orange (light from the bright inside): SSS 0.04.
- Nacre needs something to reflect on a black studio: the world is black to the camera but a dome and a front
  card to glossy rays; nacre is a thin film on a mostly metallic layer.
- The abalone was first a flat sheet with its spire hanging off the rim (Lean 80, W 40). A real one is a domed
  ear with the spire inside the outline: the aperture has to reach past the coiling axis (D below 0, here −0.24)
  and lean about 58°, with W near 12. Holes sit just inboard of the outer edge, each on a tubercle.
- The video skips a tour of the sliders: it holds the nautilus, then morphs kind to kind and ends on the abalone
  turning over. Checked as a white-clay preview before the final render.
- The first final render showed fine corrugation all over the abalone's nacre: the inner wall carried half the
  outer sculpture (ribs × cords) plus the growth-line bump. Nacre lines a real shell smooth, so under Nacre the
  inner relief drops to a tenth and the bump goes. Nacre is 0 until frame 366, so only 360–488 were rendered again
  (on the same GPU).
- Final render: Cycles 64 samples + denoise on a second PC with an RTX 4060 (OptiX), ~7 s a frame, an hour for
  488 frames.
- Tutorial: the tree was regrouped for readable screenshots (a separate `PA_Spines` group, lettered sections in
  `PA_Aperture`, `PA_WhorlClock` and the material, labels on the wires between sections). Every kind's mesh was
  compared vertex by vertex before and after: identical. `pb.audit`: strictly procedural, no issues.

## Files
- [x] loop.mp4 (20.3 s, 24 fps, 1080²) + loop_hud.mp4 (the same with W, D, T, S read out)
- [x] render.png (hero still, frame 488) + render-001.png (frame 1)
- [x] nodes/main.png + nodes/aperture.png + nodes/spines.png + nodes/material.png
- [x] audit: strict_procedural, no issues
- [x] tutorial/README.md (node-by-node walkthrough: the tube, the whorl clock, the aperture, sculpture, the wall,
      placing the curve, Raup's coil, spines, pose and fit, paint, and the material)

## Caption
Nodevember 2026 · Day 14: Shell | One tube, every shell

One Geometry Nodes group built on David Raup's 1966 coiling model grows a nautilus, an ammonite, a snail, a tower
shell, a cone, a conch, a cockle and an abalone: one curve, grown W times a turn, turned and slid down its axis.

Rules: one node group's sliders only; no image textures, no simulation, no imported assets

Made with Blender Geometry Nodes.

#nodevember #nodevember2026 #GeometryNodes #b3d
(Bluesky / X: drop the middle paragraph to fit.)

## Alt text
- On a black background a cream chambered nautilus with orange flames melts, one shape into the next, into a ribbed
  tan ammonite, a banded garden snail, a tall tower shell, a textile cone covered in brown tents, a conch with a
  flared salmon lip, a ribbed cockle with pink bands, and finally a dark red abalone that turns over to show a bowl
  of iridescent mother-of-pearl with a row of open holes along its edge.

## Posting
- [ ] Mastodon (mention @Nodevember@graphics.social)
- [ ] Bluesky (@nodevember.bsky.social)
- [ ] X (@Nodevember)
- [ ] Instagram (@nodevemberio)
- [ ] Blender Artists (tag: nodevember)
- [ ] Posted
